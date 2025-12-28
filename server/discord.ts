import type { Study } from '@shared/schema';

export async function sendDiscordNotification(studies: Study[]): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[Discord] No webhook URL configured, skipping Discord notification');
    return false;
  }

  try {
    const studyList = studies.slice(0, 10).map(study => {
      const format = study.studyFormat ? ` | ${study.studyFormat}` : '';
      return `**${study.title}**\nPayout: $${study.payout} | Duration: ${study.duration} | Type: ${study.studyType}${format}\n${study.postedAt ? `Posted: ${study.postedAt}\n` : ''}${study.link ? `[Apply Here](${study.link})` : ''}\n`;
    }).join('\n');

    const embed = {
      title: `🔔 ${studies.length} New ${studies.length === 1 ? 'Study' : 'Studies'} Found!`,
      description: `New research opportunities on Respondent.io:\n\n${studyList}`,
      color: 0x10b981,
      footer: {
        text: 'Respondent.io Monitor Agent'
      },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Discord] Webhook failed: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`[Discord] Notification sent successfully for ${studies.length} studies`);
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to send notification:', error?.message || error);
    return false;
  }
}
