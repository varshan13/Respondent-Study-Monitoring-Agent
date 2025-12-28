// Web scraper for Respondent.io public studies page using Playwright
import { chromium } from 'playwright';

const TARGET_URL = "https://app.respondent.io/respondents/v2/projects/browse";

export interface ScrapedStudy {
  externalId: string;
  title: string;
  payout: number;
  duration: string;
  studyType: string;
  studyFormat?: string;
  matchScore?: number;
  postedAt?: string;
  link?: string;
  description?: string;
}

// Parse payout from string like "$120.00" or "$200.00"
function parsePayout(payoutStr: string): number {
  const match = payoutStr.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (match) {
    return Math.round(parseFloat(match[1].replace(',', '')));
  }
  return 0;
}

export async function scrapeRespondentStudies(): Promise<ScrapedStudy[]> {
  let browser;
  try {
    console.log('Launching headless browser for Respondent.io...');
    
    // Launch browser with system chromium
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('Navigating to Respondent.io browse page...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for project cards to load
    await page.waitForSelector('a[href*="/respondents/v2/projects/view/"]', { timeout: 15000 }).catch(() => {
      console.log('No project links found, page might be loading differently');
    });
    
    // Give extra time for dynamic content
    await page.waitForTimeout(2000);
    
    // Extract study data from the page
    const studies = await page.evaluate(() => {
      const results: Array<{
        externalId: string;
        title: string;
        payout: number;
        duration: string;
        studyType: string;
        studyFormat: string;
        postedAt: string;
        link: string;
        description: string;
      }> = [];
      
      // Find all project links
      const projectLinks = document.querySelectorAll('a[href*="/respondents/v2/projects/view/"]');
      
      projectLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/view\/([a-f0-9]+)/);
        if (!idMatch) return;
        
        const externalId = idMatch[1];
        const title = link.textContent?.trim() || 'Unknown Study';
        
        // Try to find the parent card element
        let card = link.closest('.card, .project-card, [class*="project"], [class*="Card"]') || link.parentElement?.parentElement?.parentElement;
        
        if (!card) {
          card = link.parentElement;
        }
        
        // Extract text content from the card
        const cardText = card?.textContent || '';
        
        // Parse payout - look for $XX pattern
        const payoutMatch = cardText.match(/\$(\d+(?:\.\d{2})?)/);
        const payout = payoutMatch ? Math.round(parseFloat(payoutMatch[1])) : 0;
        
        // Parse duration - look for "XX min" or "X hour" pattern
        const durationMatch = cardText.match(/(\d+\s*(?:min|hour|hr)s?)/i);
        const duration = durationMatch ? durationMatch[1] : 'Unknown';
        
        // Parse posted time - look for "X hours ago" or "X days ago"
        const postedMatch = cardText.match(/(\d+\s*(?:hour|day|minute|week)s?\s*ago|a\s+(?:hour|day|minute|week)\s+ago)/i);
        const postedAt = postedMatch ? postedMatch[1] : '';
        
        // Parse study type - look for Remote/In-person
        const isRemote = cardText.toLowerCase().includes('remote');
        const isInPerson = cardText.toLowerCase().includes('in-person') || cardText.toLowerCase().includes('in person');
        const studyType = isRemote ? 'Remote' : (isInPerson ? 'In-Person' : 'Unknown');
        
        // Parse study format - look for One-on-One, Focus Group, Survey, etc.
        const isOneOnOne = cardText.toLowerCase().includes('one-on-one') || cardText.toLowerCase().includes('1-on-1');
        const isFocusGroup = cardText.toLowerCase().includes('focus group');
        const isSurvey = cardText.toLowerCase().includes('survey');
        const studyFormat = isOneOnOne ? 'One-on-One' : (isFocusGroup ? 'Focus Group' : (isSurvey ? 'Survey' : ''));
        
        // Get description - find paragraph text that's not the title
        const descElement = card?.querySelector('p, [class*="description"]');
        const description = descElement?.textContent?.trim().substring(0, 500) || '';
        
        // Avoid duplicates
        if (!results.some(r => r.externalId === externalId)) {
          results.push({
            externalId,
            title,
            payout,
            duration,
            studyType,
            studyFormat,
            postedAt,
            link: `https://app.respondent.io${href}`,
            description
          });
        }
      });
      
      return results;
    });
    
    console.log(`Scraped ${studies.length} studies from Respondent.io`);
    
    await browser.close();
    
    return studies;
  } catch (error) {
    console.error('Error scraping Respondent.io:', error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return [];
  }
}

// Alternative: Generate demo studies for testing (only used as fallback)
export function generateDemoStudies(): ScrapedStudy[] {
  const topics = [
    { title: "Software Developer Experience Research", payout: 150, duration: "45 min" },
    { title: "Cloud Infrastructure Usage Study", payout: 200, duration: "60 min" },
    { title: "Consumer Banking Habits Interview", payout: 100, duration: "30 min" },
    { title: "AI Tool Adoption in Enterprise", payout: 175, duration: "45 min" },
    { title: "Remote Work Challenges Survey", payout: 75, duration: "20 min" },
    { title: "E-commerce Shopping Preferences", payout: 125, duration: "35 min" },
  ];
  
  // Randomly pick 0-2 "new" studies
  const numStudies = Math.random() > 0.5 ? Math.floor(Math.random() * 2) + 1 : 0;
  const selected = topics.sort(() => Math.random() - 0.5).slice(0, numStudies);
  
  return selected.map((study, i) => ({
    externalId: `demo-${Date.now()}-${i}`,
    title: study.title,
    payout: study.payout,
    duration: study.duration,
    studyType: Math.random() > 0.3 ? "Remote" : "In-Person",
    matchScore: Math.floor(Math.random() * 20) + 80,
    postedAt: new Date().toISOString(),
    link: "https://app.respondent.io/respondents/v2/projects/browse",
  }));
}
