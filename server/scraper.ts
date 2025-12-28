// Web scraper for Respondent.io
// Note: This requires authentication to access the actual studies
// For now, we'll fetch what's publicly accessible

import type { InsertStudy } from "@shared/schema";

const TARGET_URL = "https://app.respondent.io/respondents/v2/projects/browse";

export interface ScrapedStudy {
  externalId: string;
  title: string;
  payout: number;
  duration: string;
  studyType: string;
  matchScore?: number;
  postedAt?: string;
  link?: string;
  description?: string;
}

// Parse payout from string like "$150" or "Up to $200"
function parsePayout(payoutStr: string): number {
  const matches = payoutStr.match(/\$(\d+)/g);
  if (matches && matches.length > 0) {
    // Get the highest value if there are multiple
    const values = matches.map(m => parseInt(m.replace('$', '')));
    return Math.max(...values);
  }
  return 0;
}

// Parse duration from string like "30 min" or "1 hour"
function parseDuration(durationStr: string): string {
  return durationStr.trim();
}

export async function scrapeRespondentStudies(): Promise<ScrapedStudy[]> {
  try {
    // Respondent.io is a React SPA that requires authentication
    // The studies are loaded via API calls after login
    // Without authentication, we cannot access the actual studies
    
    // For this implementation, we'll need the user to provide their session
    // OR we can try to fetch the public API if available
    
    // Let's try fetching the page to see what's available
    const response = await fetch(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      console.log(`Respondent.io returned status ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    // Check if we got a login page (which is expected without auth)
    if (html.includes('Sign in') || html.includes('login')) {
      console.log('Respondent.io requires authentication to view studies');
      // Return empty - the user would need to provide session cookies
      return [];
    }

    // If we somehow got the actual page, try to parse it
    // This is a basic parser - in reality the page is rendered by JavaScript
    const studies: ScrapedStudy[] = [];
    
    // Look for any JSON data embedded in the page
    const scriptMatches = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/);
    if (scriptMatches) {
      try {
        const data = JSON.parse(scriptMatches[1]);
        if (data.projects) {
          for (const project of data.projects) {
            studies.push({
              externalId: project.id || String(Date.now()),
              title: project.title || 'Unknown Study',
              payout: project.incentive || 0,
              duration: project.duration || 'Unknown',
              studyType: project.type || 'Remote',
              matchScore: project.matchScore,
              postedAt: project.createdAt,
              link: `https://app.respondent.io/respondents/v2/projects/${project.id}`,
              description: project.description,
            });
          }
        }
      } catch (e) {
        console.log('Failed to parse embedded JSON');
      }
    }

    return studies;
  } catch (error) {
    console.error('Error scraping Respondent.io:', error);
    return [];
  }
}

// Alternative: Generate demo studies for testing
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
