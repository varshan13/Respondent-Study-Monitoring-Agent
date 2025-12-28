// Respondent.io Monitor Agent - Background Only
// Checks for new studies every 10 minutes and sends email notifications

import { chromium } from 'playwright';
import { Resend } from 'resend';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { pgTable, text, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql, eq, desc } from 'drizzle-orm';

const { Pool } = pg;

// ============== Configuration ==============
const CHECK_INTERVAL_MINUTES = 10;
const TARGET_URL = "https://app.respondent.io/respondents/v2/projects/browse";
const CHROMIUM_PATH = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';

// Email recipients - add your email addresses here
const EMAIL_RECIPIENTS = [
  'harishvarshansiva@gmail.com',
];

// ============== Database Schema ==============
const studies = pgTable("agent_studies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  payout: integer("payout").notNull(),
  duration: text("duration").notNull(),
  studyType: text("study_type").notNull(),
  postedAt: text("posted_at"),
  link: text("link"),
  description: text("description"),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============== Database Setup ==============
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ============== Resend Email Setup ==============
let resendClient: Resend | null = null;
let fromEmail = 'onboarding@resend.dev';

async function initResend() {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken || !hostname) {
      console.log('[Email] Replit connector not available, emails disabled');
      return;
    }

    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );
    
    const data = await response.json();
    const settings = data.items?.[0]?.settings;
    
    if (settings?.api_key) {
      resendClient = new Resend(settings.api_key);
      fromEmail = settings.from_email || 'onboarding@resend.dev';
      console.log('[Email] Resend initialized successfully');
    }
  } catch (e) {
    console.log('[Email] Failed to initialize Resend:', e);
  }
}

// ============== Types ==============
interface ScrapedStudy {
  externalId: string;
  title: string;
  payout: number;
  duration: string;
  studyType: string;
  postedAt: string;
  link: string;
  description: string;
}

// ============== Scraper ==============
async function scrapeStudies(): Promise<ScrapedStudy[]> {
  let browser;
  try {
    console.log('[Scraper] Launching headless browser...');
    
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('[Scraper] Navigating to Respondent.io...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    await page.waitForSelector('a[href*="/respondents/v2/projects/view/"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    const studiesData = await page.evaluate(() => {
      const results: ScrapedStudy[] = [];
      const projectLinks = document.querySelectorAll('a[href*="/respondents/v2/projects/view/"]');
      
      projectLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/view\/([a-f0-9]+)/);
        if (!idMatch) return;
        
        const externalId = idMatch[1];
        const title = link.textContent?.trim() || 'Unknown Study';
        let card = link.closest('.card, .project-card, [class*="project"]') || link.parentElement?.parentElement;
        const cardText = card?.textContent || '';
        
        const payoutMatch = cardText.match(/\$(\d+(?:\.\d{2})?)/);
        const payout = payoutMatch ? Math.round(parseFloat(payoutMatch[1])) : 0;
        
        const durationMatch = cardText.match(/(\d+\s*(?:min|hour|hr)s?)/i);
        const duration = durationMatch ? durationMatch[1] : 'Unknown';
        
        const postedMatch = cardText.match(/(\d+\s*(?:hour|day|minute|week)s?\s*ago)/i);
        const postedAt = postedMatch ? postedMatch[1] : '';
        
        const isRemote = cardText.toLowerCase().includes('remote');
        const studyType = isRemote ? 'Remote' : 'In-Person';
        
        const descElement = card?.querySelector('p');
        const description = descElement?.textContent?.trim().substring(0, 500) || '';
        
        if (!results.some(r => r.externalId === externalId)) {
          results.push({
            externalId,
            title,
            payout,
            duration,
            studyType,
            postedAt,
            link: `https://app.respondent.io${href}`,
            description
          });
        }
      });
      
      return results;
    });
    
    await browser.close();
    console.log(`[Scraper] Found ${studiesData.length} studies`);
    return studiesData;
  } catch (error) {
    console.error('[Scraper] Error:', error);
    if (browser) await browser.close().catch(() => {});
    return [];
  }
}

// ============== Email Sender ==============
async function sendNotification(newStudies: ScrapedStudy[]) {
  if (!resendClient || EMAIL_RECIPIENTS.length === 0) {
    console.log('[Email] Skipping notification (no client or recipients)');
    return;
  }
  
  const studyList = newStudies.map(study => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #111827;">${study.title}</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          <strong>Payout:</strong> $${study.payout} | 
          <strong>Duration:</strong> ${study.duration} | 
          <strong>Type:</strong> ${study.studyType}
        </p>
        ${study.postedAt ? `<p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 12px;">Posted: ${study.postedAt}</p>` : ''}
        <p style="margin: 8px 0 0 0;"><a href="${study.link}" style="color: #10b981;">View Study →</a></p>
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; background: #f3f4f6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔔 ${newStudies.length} New Studies Found!</h1>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">${studyList}</table>
            <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              <a href="https://app.respondent.io/respondents/v2/projects/browse" style="color: #10b981;">View all on Respondent.io →</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  for (const email of EMAIL_RECIPIENTS) {
    try {
      await resendClient.emails.send({
        from: fromEmail,
        to: email,
        subject: `🔔 ${newStudies.length} New Studies on Respondent.io`,
        html,
      });
      console.log(`[Email] Sent notification to ${email}`);
    } catch (e) {
      console.error(`[Email] Failed to send to ${email}:`, e);
    }
  }
}

// ============== Main Check Logic ==============
async function runCheck() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[Agent] Running check at ${new Date().toLocaleString()}`);
  console.log('='.repeat(50));
  
  const scrapedStudies = await scrapeStudies();
  
  if (scrapedStudies.length === 0) {
    console.log('[Agent] No studies found');
    return;
  }
  
  const newStudies: ScrapedStudy[] = [];
  
  for (const study of scrapedStudies) {
    try {
      // Check if study already exists
      const existing = await db.select().from(studies).where(eq(studies.externalId, study.externalId));
      
      if (existing.length === 0) {
        // New study - save it
        await db.insert(studies).values({
          externalId: study.externalId,
          title: study.title,
          payout: study.payout,
          duration: study.duration,
          studyType: study.studyType,
          postedAt: study.postedAt,
          link: study.link,
          description: study.description,
          notified: false,
        });
        newStudies.push(study);
        console.log(`[Agent] NEW: "${study.title}" - $${study.payout}`);
      }
    } catch (e) {
      // Ignore duplicate key errors
    }
  }
  
  if (newStudies.length > 0) {
    console.log(`[Agent] Found ${newStudies.length} new studies!`);
    await sendNotification(newStudies);
    
    // Mark as notified
    for (const study of newStudies) {
      await db.update(studies).set({ notified: true }).where(eq(studies.externalId, study.externalId));
    }
  } else {
    console.log('[Agent] No new studies since last check');
  }
}

// ============== Initialize Database Table ==============
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_studies (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        payout INTEGER NOT NULL,
        duration TEXT NOT NULL,
        study_type TEXT NOT NULL,
        posted_at TEXT,
        link TEXT,
        description TEXT,
        notified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[Database] Table ready');
  } catch (e) {
    console.error('[Database] Init error:', e);
  }
}

// ============== Main Entry Point ==============
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       RESPONDENT.IO MONITOR AGENT                ║');
  console.log('║       Background Study Monitor                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Check Interval: Every ${CHECK_INTERVAL_MINUTES} minutes               ║`);
  console.log(`║  Recipients: ${EMAIL_RECIPIENTS.length} email(s)                         ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  
  await initDatabase();
  await initResend();
  
  // Run initial check
  await runCheck();
  
  // Schedule recurring checks
  const intervalMs = CHECK_INTERVAL_MINUTES * 60 * 1000;
  console.log(`\n[Agent] Next check in ${CHECK_INTERVAL_MINUTES} minutes...`);
  
  setInterval(async () => {
    await runCheck();
    console.log(`\n[Agent] Next check in ${CHECK_INTERVAL_MINUTES} minutes...`);
  }, intervalMs);
}

main().catch(console.error);
