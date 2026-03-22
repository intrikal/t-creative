/**
 * lib/alert.ts — Operational alert notifications.
 *
 * Sends a plain-text message to a Discord webhook and/or Telegram bot when
 * something needs immediate admin attention (e.g. Square signature failures).
 *
 * Both channels are optional — configure whichever you use via env vars:
 *   DISCORD_ALERT_WEBHOOK_URL  — Discord Incoming Webhook URL
 *   TELEGRAM_ALERT_BOT_TOKEN   — Telegram bot token
 *   TELEGRAM_ALERT_CHAT_ID     — Telegram chat/channel ID (with leading -)
 *
 * If neither is configured the function logs to stderr so alerts are still
 * visible in Vercel function logs.
 */

export async function sendAlert(message: string): Promise<void> {
  const promises: Promise<unknown>[] = [];

  const discordUrl = process.env.DISCORD_ALERT_WEBHOOK_URL;
  if (discordUrl) {
    promises.push(
      fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      }).catch(() => {
        // Non-fatal — don't mask the original alert trigger
      }),
    );
  }

  const telegramToken = process.env.TELEGRAM_ALERT_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (telegramToken && telegramChatId) {
    promises.push(
      fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChatId, text: message }),
      }).catch(() => {}),
    );
  }

  if (promises.length === 0) {
    console.error(`[ALERT] ${message}`);
    return;
  }

  await Promise.all(promises);
}
