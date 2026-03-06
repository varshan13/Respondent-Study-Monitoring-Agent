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
  pageOrder: number;
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
        pageOrder: number;
      }> = [];
      
      // Find all project links
      const projectLinks = document.querySelectorAll('a[href*="/respondents/v2/projects/view/"]');
      
      for (let linkIdx = 0; linkIdx < projectLinks.length; linkIdx++) {
        const link = projectLinks[linkIdx];
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/\/view\/([a-f0-9]+)/);
        if (!idMatch) continue;
        
        const externalId = idMatch[1];
        const title = link.textContent?.trim() || 'Unknown Study';
        
        // Try to find the parent card element
        let card = link.closest('.card, .project-card, [class*="project"], [class*="Card"]') || link.parentElement?.parentElement?.parentElement;
        
        if (!card) {
          card = link.parentElement;
        }
        
        // Extract text content from the card
        const cardText = card?.textContent || '';
        
        // Normalize card text - handle special Unicode hyphens (non-breaking hyphens, en-dashes, etc.)
        const normalizedCardText = cardText
          .normalize('NFKD')
          .replace(/[\u2010-\u2015\u2212\u00AD]/g, '-')
          .toLowerCase()
          .trim();
        
        // Try to extract metadata tokens from specific metadata elements
        // Look for spans that contain the dot-separated metadata (e.g., "$500.00 · 15 hours ago · 60 min · One-on-One · In-person")
        const metaTokens: string[] = [];
        const metaElements = card?.querySelectorAll('span, [class*="meta"], [class*="badge"], [class*="tag"], [class*="chip"]');
        if (metaElements) {
          for (let i = 0; i < metaElements.length; i++) {
            const el = metaElements[i];
            const text = el.textContent?.trim() || '';
            if (text) {
              // Split by various bullet/dot separators and add each token
              const parts = text.split(/[·•|,]/);
              for (let j = 0; j < parts.length; j++) {
                const normalized = parts[j]
                  .normalize('NFKD')
                  .replace(/[\u2010-\u2015\u2212\u00AD]/g, '-')
                  .toLowerCase()
                  .trim();
                if (normalized.length > 0 && normalized.length < 50) {
                  metaTokens.push(normalized);
                }
              }
            }
          }
        }
        
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
        let hasRemoteToken = false;
        let hasInPersonToken = false;
        for (let k = 0; k < metaTokens.length; k++) {
          if (metaTokens[k] === 'remote') hasRemoteToken = true;
          if (metaTokens[k] === 'in-person' || metaTokens[k] === 'in person') hasInPersonToken = true;
        }
        const isRemote = normalizedCardText.includes('remote') || hasRemoteToken;
        const isInPerson = normalizedCardText.includes('in-person') || normalizedCardText.includes('in person') || hasInPersonToken;
        const studyType = isRemote ? 'Remote' : (isInPerson ? 'In-Person' : 'Unknown');
        
        // Parse study format - look for One-on-One, Focus Group, Survey, Unmoderated, etc.
        // Combine all text for checking
        const allText = normalizedCardText + ' ' + metaTokens.join(' ');
        
        let studyFormat = '';
        if (allText.includes('one-on-one') || allText.includes('1-on-1') || allText.includes('1:1')) {
          studyFormat = 'One-on-One';
        } else if (allText.includes('unmoderated')) {
          studyFormat = 'Unmoderated';
        } else if (allText.includes('moderated') && !allText.includes('unmoderated')) {
          studyFormat = 'Moderated';
        } else if (allText.includes('focus group')) {
          studyFormat = 'Focus Group';
        } else if (allText.includes('survey') && !allText.includes('video survey')) {
          studyFormat = 'Survey';
        } else if (allText.includes('interview')) {
          studyFormat = 'Interview';
        } else if (allText.includes('diary') || allText.includes('journal')) {
          studyFormat = 'Diary Study';
        } else if (allText.includes('usability') || allText.includes('ux test')) {
          studyFormat = 'Usability Test';
        }
        
        // Get description - find paragraph text that's not the title
        const descElement = card?.querySelector('p, [class*="description"]');
        const description = descElement?.textContent?.trim().substring(0, 500) || '';
        
        // Avoid duplicates - check if externalId already exists
        let isDuplicate = false;
        for (let k = 0; k < results.length; k++) {
          if (results[k].externalId === externalId) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          results.push({
            externalId,
            title,
            payout,
            duration,
            studyType,
            studyFormat,
            postedAt,
            link: `https://app.respondent.io${href}`,
            description,
            pageOrder: results.length
          });
        }
      }
      
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

export async function scrapeUserInterviewsStudies(): Promise<ScrapedStudy[]> {
  let browser;
  try {
    console.log('Launching headless browser for User Interviews...');
    
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('Navigating to User Interviews browse page...');
    await page.goto("https://www.userinterviews.com/studies?sort=-id", { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    // Wait for anything that looks like a study link
    await page.waitForSelector('a[href*="/projects/"], a[href*="/studies/"]', { timeout: 20000 }).catch(() => {
      console.log('Timeout waiting for User Interviews study links');
    });
    
    // Scroll down multiple times to trigger lazy loading for up to 50 studies
    await page.evaluate(async () => {
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 1500);
        await new Promise(r => setTimeout(r, 1500));
      }
    });
    await page.waitForTimeout(3000);
    
    // Extract study data from the page
    const studies = await page.evaluate(() => {
      const results: any[] = [];
      const seenIds = new Set();
      
      // Based on HTML inspection, User Interviews uses ProjectListing__title class for titles
      // and has specific apply buttons.
      const listings = Array.from(document.querySelectorAll('h2[class*="ProjectListing__title"]'));
      
      console.log(`Found ${listings.length} ProjectListing title elements`);

      for (let i = 0; i < listings.length; i++) {
        const titleEl = listings[i] as HTMLElement;
        const title = titleEl.textContent?.trim() || 'Unknown Study';
        
        // Find the container for this listing by going up until we find a shared parent or a container-like element
        let card: HTMLElement | null = titleEl.parentElement;
        while (card && !card.textContent?.includes('$') && card.parentElement && card.parentElement.tagName !== 'BODY') {
          card = card.parentElement;
        }
        
        if (!card) continue;
        const text = card.textContent || '';

        // Find the specific apply link to get the ID
        const applyLink = card.querySelector('a[href*="/projects/"]');
        const href = applyLink?.getAttribute('href') || '';
        
        let externalId = '';
        if (href) {
          const parts = href.split('/').filter(Boolean);
          // ID is usually after /projects/
          const pIdx = parts.indexOf('projects');
          if (pIdx !== -1 && parts[pIdx + 1]) {
            externalId = parts[pIdx + 1];
          } else {
            externalId = parts[parts.length - 1];
          }
        }
        
        if (!externalId || externalId === 'apply') {
          externalId = `ui-gen-${title.replace(/[^a-z0-9]/gi, '').substring(0, 20)}-${i}`;
        }
        
        if (seenIds.has(externalId)) continue;
        seenIds.add(externalId);

        // Payout and Duration extraction - specifically targeting their known layout
        // Incentive is usually at the top right, Duration is below it.
        // We look for the incentive first ($XX)
        const incentiveEl = card.querySelector('.ProjectListing__incentive, [class*="incentive"], [class*="Incentive"]');
        const durationEl = card.querySelector('.ProjectListing__duration, [class*="duration"], [class*="Duration"]');
        
        let payout = 0;
        let duration = 'Unknown';

        if (incentiveEl) {
          const pMatch = incentiveEl.textContent?.match(/\d+/);
          payout = pMatch ? parseInt(pMatch[0]) : 0;
        } else {
          const pMatch = text.match(/\$\s*(\d+(?:,\d{3})*)/);
          payout = pMatch ? parseInt(pMatch[1].replace(/,/g, '')) : 0;
        }

        if (durationEl) {
          duration = durationEl.textContent?.trim() || 'Unknown';
        } else {
          // Fallback regex that avoids the payout number
          const dMatch = text.match(/(\d+)\s*(?:min|hour|hr|minute)s?\b/i);
          if (dMatch) {
            duration = dMatch[0].toLowerCase().includes('hour') || dMatch[0].toLowerCase().includes('hr') ? `${dMatch[1]} hr` : `${dMatch[1]} min`;
          }
        }

        if (payout <= 0) continue;

        // Study Format/Type extraction from badges
        const badges = Array.from(card.querySelectorAll('[class*="badge"], [class*="Tag"], .ProjectListing__type')).map(b => b.textContent?.toLowerCase() || '');
        const badgeText = badges.join(' ');
        
        const isRemote = badgeText.includes('online') || badgeText.includes('remote') || text.toLowerCase().includes('online') || text.toLowerCase().includes('remote');
        const isUnmoderated = badgeText.includes('unmoderated') || text.toLowerCase().includes('unmoderated');
        const isOneOnOne = badgeText.includes('1-on-1') || badgeText.includes('interview') || text.toLowerCase().includes('1-on-1') || text.toLowerCase().includes('interview');

        results.push({
          externalId,
          title,
          payout,
          duration,
          studyType: isRemote ? 'Remote' : 'In-Person',
          studyFormat: isUnmoderated ? 'Unmoderated' : (isOneOnOne ? 'One-on-One' : ''),
          postedAt: 'New',
          link: href ? (href.startsWith('http') ? href : `https://www.userinterviews.com${href}`) : `https://www.userinterviews.com/studies`,
          description: card.querySelector('.ProjectListing__description, [class*="description"], p')?.textContent?.trim().substring(0, 500) || '',
          pageOrder: results.length
        });
        
        if (results.length >= 50) break;
      }
      
      return results;
    });
    
    console.log(`Scraped ${studies.length} studies from User Interviews`);
    await browser.close();
    return studies;
  } catch (error) {
    console.error('Error scraping User Interviews:', error);
    if (browser) await browser.close().catch(() => {});
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
