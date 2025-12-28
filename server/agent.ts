// Background agent that monitors Respondent.io for new studies
import { storage } from "./storage";
import { sendStudyNotification } from "./email";
import { scrapeRespondentStudies, generateDemoStudies } from "./scraper";
import type { Study } from "@shared/schema";

let agentInterval: NodeJS.Timeout | null = null;
let isRunning = false;

async function addLog(message: string, logType: "info" | "success" | "warning" | "error") {
  try {
    await storage.addCheckLog({ message, logType });
  } catch (e) {
    console.error("Failed to add log:", e);
  }
  console.log(`[Agent ${logType.toUpperCase()}] ${message}`);
}

export async function runCheck(): Promise<Study[]> {
  await addLog("Initiating scheduled check...", "info");
  
  try {
    // Scrape real studies from Respondent.io public page
    const scrapedStudies = await scrapeRespondentStudies();
    
    if (scrapedStudies.length === 0) {
      await addLog("No studies found on Respondent.io page", "info");
      return [];
    }
    
    await addLog(`Found ${scrapedStudies.length} potential studies`, "info");
    
    // Check which studies are new (not already in database)
    const newStudies: Study[] = [];
    
    for (const scraped of scrapedStudies) {
      const existing = await storage.getStudyByExternalId(scraped.externalId);
      if (!existing) {
        // This is a new study - save it
        const saved = await storage.createStudy({
          externalId: scraped.externalId,
          title: scraped.title,
          payout: scraped.payout,
          duration: scraped.duration,
          studyType: scraped.studyType,
          matchScore: scraped.matchScore || null,
          postedAt: scraped.postedAt || null,
          link: scraped.link || null,
          description: scraped.description || null,
          notified: false,
        });
        newStudies.push(saved);
        await addLog(`New study: "${saved.title}" ($${saved.payout})`, "success");
      }
    }
    
    if (newStudies.length === 0) {
      await addLog("All studies already known - no new matches", "info");
      return [];
    }
    
    // Send email notifications for new studies
    const activeRecipients = await storage.getActiveEmailRecipients();
    if (activeRecipients.length > 0) {
      const emails = activeRecipients.map(r => r.email);
      await addLog(`Sending notifications to ${emails.length} recipient(s)...`, "warning");
      
      const success = await sendStudyNotification(emails, newStudies);
      if (success) {
        await addLog(`Email notifications sent successfully`, "success");
        // Mark studies as notified
        for (const study of newStudies) {
          await storage.markStudyNotified(study.id);
        }
      } else {
        await addLog(`Failed to send email notifications`, "error");
      }
    } else {
      await addLog("No active email recipients configured", "warning");
    }
    
    return newStudies;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await addLog(`Check failed: ${msg}`, "error");
    return [];
  }
}

export async function startAgent() {
  if (isRunning) {
    await addLog("Agent already running", "warning");
    return;
  }
  
  const settings = await storage.getAgentSettings();
  if (!settings?.isActive) {
    await addLog("Agent is disabled in settings", "info");
    return;
  }
  
  isRunning = true;
  const intervalMs = (settings.checkIntervalMinutes || 10) * 60 * 1000;
  
  await addLog(`Agent started (PID: ${process.pid})`, "info");
  await addLog(`Check interval: ${settings.checkIntervalMinutes} minutes`, "info");
  await addLog(`Monitoring: https://app.respondent.io/respondents/v2/projects/browse`, "info");
  
  // Run initial check
  await runCheck();
  await storage.updateAgentSettings({ lastCheckAt: new Date() });
  
  // Schedule recurring checks
  agentInterval = setInterval(async () => {
    const currentSettings = await storage.getAgentSettings();
    if (!currentSettings?.isActive) {
      await stopAgent();
      return;
    }
    
    await addLog(`Starting check (interval: ${currentSettings.checkIntervalMinutes}m)...`, "info");
    await runCheck();
    await storage.updateAgentSettings({ lastCheckAt: new Date() });
  }, intervalMs);
  
  await addLog(`Next check in ${settings.checkIntervalMinutes} minutes`, "info");
}

export async function stopAgent() {
  if (agentInterval) {
    clearInterval(agentInterval);
    agentInterval = null;
  }
  isRunning = false;
  await addLog("Agent stopped", "info");
}

export function isAgentRunning(): boolean {
  return isRunning;
}

export async function restartAgent() {
  await stopAgent();
  await startAgent();
}
