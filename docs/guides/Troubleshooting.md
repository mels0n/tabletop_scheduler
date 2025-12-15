# Troubleshooting Guide

Common issues and how to resolve them.

## Telegram Bot Not Replying

### 1. Check your Environment
*   **Development (Localhost)**: The app uses **Polling** mode. It checks for updates every few seconds. You do **not** need to set a Webhook or have a public URL.
*   **Production**: The app uses **Webhook** mode. You must have a valid public HTTPS URL (e.g., via Nginx or Cloudflare) and the bot must be configured to send updates there.

### 2. "Conflict: terminated by other getUpdates request"
If you see this error in your logs, you likely have two instances of the app running, or you are trying to use Polling (Dev) while a Webhook is still active from a previous Production deployment.
*   **Fix**: Go to `https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook` to clear any old hooks if you are testing locally.

## Timestamps are Wrong

TabletopTime relies on the server's timezone for logs and cron jobs (cleanup).
*   **Docker**: Ensure you passed the `TZ` environment variable (e.g., `-e TZ=America/New_York`).
*   **Manual**: The app uses the system time. Check your server's clock `date`.

## "Manager" Features Missing

If you cannot see "DM Me Manager Link" or "Finalize Event":
1.  **Ownership**: You are likely visiting the page as a Guest. You need to login.
2.  **No Manager Linked**: If you created the event without being logged in, there is no manager.
    *   **Fix**: Use the "Register for Magic Links" button on the management page, then ask the bot to `/recover <slug>`.

## Database Locked

SQLite can only handle one writer at a time.
*   Ensure you don't have the database file open in a viewer (like DB Browser for SQLite) while the app is running.
*   If using Docker, ensure the volume permissions are correct.
