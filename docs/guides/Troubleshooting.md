# Troubleshooting Guide

Common issues and how to resolve them.

## Container Exits Immediately or "unable to open database file"

The container runs as the `node` user (UID 1000). If you bind-mount a host directory at `/app/data` and that directory is owned by someone else, the database cannot be created.

*   **Fix:** make the directory writable by UID 1000: `sudo chown -R 1000:1000 ./data`. A named Docker volume avoids this.
*   Check the container log (`docker logs tabletop-time`). The startup script prints the permissions of `/app/data` before it touches the database.

## Startup Stops With a Data Loss Warning

On every start the Docker image runs `prisma db push` against the SQLite database. If a release changes the schema in a way that would delete data (dropping a column or table), Prisma refuses and the container stops rather than delete anything.

*   **Fix:** back up `/app/data/scheduler.db`, then start the container once with `-e PRISMA_ACCEPT_DATA_LOSS=1`. Remove the variable afterwards so a later surprise change cannot slip through.

## Server Will Not Start: Configuration Error

Configuration is validated at boot, and the error lists every missing or invalid variable at once. Common ones:

*   `NEXT_PUBLIC_BASE_URL is required when a bot token is configured`: set it to your public URL. The only exception is Telegram polling mode on a self-hosted instance.
*   `SESSION_SECRET` missing in production: set 32 or more random bytes. (The Docker image generates one into `/app/data` if you do not.)
*   `CRON_SECRET` missing on a hosted deployment: set it, and use the same value in the Supabase Vault (see [HostedMaintenance.md](HostedMaintenance.md)).

## Telegram Bot Not Replying

### 1. Check your Environment
*   **Mode**: The app uses **webhook** mode when a bot token and `NEXT_PUBLIC_BASE_URL` are both set, and **polling** when only the token is set. `TELEGRAM_MODE` overrides this (`webhook`, `polling`, or `off`). See [TelegramSetup.md](TelegramSetup.md).
*   **Webhook mode** needs a valid public HTTPS URL (e.g., via Nginx or Cloudflare).
*   **Polling mode** needs nothing public, but links the bot sends only work from the machine running the app unless `NEXT_PUBLIC_BASE_URL` is set.

### 2. "Conflict: terminated by other getUpdates request"
If you see this error in your logs, you likely have two instances of the app polling with the same bot token, or a webhook is still registered for the bot while you poll.
*   **Fix**: Stop the second instance. If a stale webhook is the cause, go to `https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook` once to clear it, then restart in polling mode.

### 3. The bot ignores `/connect`
The bot only accepts `/connect <slug> <code>`, where the code is shown on the event's manage page. A bare `/connect <slug>`, `/start <slug>`, or a pasted event link will not connect a chat. Copy the full command from the manage page.

## Timestamps are Wrong

Each event stores its own timezone, and reminders are computed in that timezone. Server timezone does not affect when reminders fire.
*   If a time displays wrong, check the timezone chosen when the event was created.
*   Server logs are timestamped in UTC.

## "Manager" Features Missing

If you cannot see "DM Me Manager Link" or "Finalize Event":
1.  **Ownership**: You are likely visiting the page as a Guest. Open the manage link you were given when you created the event, in the browser you used then.
2.  **No Manager Linked**: If you created the event without linking Telegram or Discord, there is no stored manager identity to send a login link to.
    *   **Fix**: From a browser that still has the manage link, use the "Register for Magic Links" button on the management page to link Telegram or Discord.
3.  **Login link not arriving**: The "DM Me Manager Link" button has a short cooldown per event. Wait a minute and try again. The recipient must have started a chat with the bot.

## Database Locked

SQLite can only handle one writer at a time.
*   Ensure you don't have the database file open in a viewer (like DB Browser for SQLite) while the app is running.
*   If using Docker, ensure the volume permissions are correct (see the UID 1000 note above).
