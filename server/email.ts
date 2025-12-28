// Email service using Gmail integration
import { google } from 'googleapis';
import type { Study } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function createEmailMessage(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html
  ].join('\r\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendStudyNotification(emails: string[], studies: Study[]): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    
    const studyList = studies.map(study => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #111827;">${study.title}</h3>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            <strong>Payout:</strong> $${study.payout} | 
            <strong>Duration:</strong> ${study.duration} | 
            <strong>Type:</strong> ${study.studyType}
            ${study.matchScore ? ` | <strong>Match:</strong> ${study.matchScore}%` : ''}
          </p>
          ${study.postedAt ? `<p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 12px;">Posted: ${study.postedAt}</p>` : ''}
          ${study.link ? `<p style="margin: 8px 0 0 0;"><a href="${study.link}" style="color: #10b981; text-decoration: none;">View Study →</a></p>` : ''}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Studies Found on Respondent.io</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Studies Found!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Respondent.io Monitor Agent</p>
            </div>
            <div style="padding: 24px;">
              <p style="color: #374151; margin: 0 0 16px 0;">
                We found <strong>${studies.length} new ${studies.length === 1 ? 'study' : 'studies'}</strong> matching your profile:
              </p>
              <table style="width: 100%; border-collapse: collapse;">
                ${studyList}
              </table>
              <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                Visit <a href="https://app.respondent.io/respondents/v2/projects/browse" style="color: #10b981;">Respondent.io</a> to apply.
              </p>
            </div>
            <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Sent by your Respondent.io Monitor Agent
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `${studies.length} New ${studies.length === 1 ? 'Study' : 'Studies'} Found on Respondent.io`;

    console.log(`[Email] Sending to ${emails.length} recipient(s) via Gmail...`);
    
    for (const email of emails) {
      try {
        const rawMessage = createEmailMessage(email, subject, html);
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: rawMessage
          }
        });
        console.log(`[Email] Sent to ${email} successfully`);
      } catch (emailError: any) {
        console.error(`[Email] Failed to send to ${email}:`, emailError?.message || emailError);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send notifications:', error?.message || error);
    return false;
  }
}
