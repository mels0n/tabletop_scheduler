# Troubleshooting Guide

Common issues and how to resolve them.

## Container Exits Immediately or "unable to open database file"

The container runs as the `node` user (UID 1000). If you bind-mount a host directory at `/app/data` and that directory is owned by someone else, the database cannot be created.

*   **Fix:** make the directory writable by UID 1000: `sudo chown -R 1000:1000 ./data`. A named Docker volume avoids this.
*   Check the container log (`docker logs tabletop-time`). The startup script prints the permissions of `/app/data` before it touches the database.

## Container Exits: "DATABASE_URL must be a SQLite file URL"

The Docker image supports SQLite only. Leave `DATABASE_URL` unset (it defaults to `file:/app/data/scheduler.db`) or set it to another `file:` path inside the data volume. A Postgres URL is refused.

## Startup Stops With a Data Loss Warning

On every start the Docker image runs `prisma db push` against the SQLite database. Releases only ever add to the schema, and CI checks that every past release upgrades cleanly, so a normal upgrade never stops here. If it does, the database is usually in a state no release produced (edited by hand, for example). Prisma refuses the change and the container stops rather than delete anything.

*   **Fix (recovery only):** back up `/app/data/scheduler.db`, then start the container once with `-e PRISMA_ACCEPT_DATA_LOSS=1`. Remove the variable afterwards so a later surprise change cannot slip through.

## Container Exits While Applying Data Migrations

After the schema step, the container runs any pending data migrations, each once and in its own transaction. If one fails, the container stops so the app never runs against half-migrated data; nothing from the failed migration is kept, and the next start retries it. Read the log line above the failure, fix the cause (disk space and file permissions are the usual ones), and restart.

## Server Will Not Start: Configuration Error

Configuration is validated at boot, and the error lists every missing or invalid variable at once. Common ones:

*   `NEXT_PUBLIC_BASE_URL is required when a bot token is configured`: set it to the URL your players use to reach the app. Hosted and Vercel deployments refuse to start without it when any Telegram or Discord bot token is set. A self-hosted install starts anyway and logs `bot links will fail until NEXT_PUBLIC_BASE_URL is set` instead; set it to fix the links.
*   `SESSION_SECRET` missing in production: set 32 or more random bytes. (The Docker image generates one into `/app/data` if you do not.)
*   `CRON_SECRET` missing on a hosted deployment: set it, and use the same value in the Supabase Vault (see [HostedMaintenance.md](HostedMaintenance.md)).
*   `TELEGRAM_MODE: polling is not supported on Vercel`: use `webhook` on Vercel.

## Telegram Bot Not Replying

### 1. Check your Environment
*   **Mode**: With a bot token, the app uses **webhook** mode unless `TELEGRAM_MODE` says otherwise (`webhook`, `polling`, or `off`). Polling is never chosen automatically. See [TelegramSetup.md](TelegramSetup.md).
*   **Webhook mode** needs `NEXT_PUBLIC_BASE_URL` to be a public HTTPS URL that reaches the app (e.g., via Nginx or Cloudflare). To re-register the webhook by hand, call `GET /api/telegram/setup` with `Authorization: Bearer <CRON_SECRET>`.
*   **Polling mode** needs nothing public, but `NEXT_PUBLIC_BASE_URL` is still required, and the links the bot sends only work for people who can reach that address.

### 2. "Conflict: terminated by other getUpdates request"
If you see a 409 conflict in your logs, you likely have two instances of the app polling with the same bot token, or a webhook is still registered for the bot while you poll. The app never deletes a webhook on its own.
*   **Fix**: Stop the second instance. If a stale webhook is the cause, go to `https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook` once to clear it, then restart in polling mode.

### 3. The bot ignores `/connect`
The bot only accepts `/connect <slug> <code>`, where the code is shown on the event's manage page. A bare `/connect <slug>`, `/start <slug>`, or a pasted event link will not connect a chat. Each code works once, so after a successful connect copy the new command from the manage page.

### 4. The bot will not send a login link in a group
`/start login` only works in a private chat with the bot. In a group the bot asks you to message it directly, so a login link is never visible to other members.

## Timestamps are Wrong

Each event stores its own timezone, and reminders are computed in that timezone. Server timezone does not affect when reminders fire.
*   If a time displays wrong, check the timezone chosen when the event was created.
*   Server logs are timestamped in UTC.

## "Manager" Features Missing

If you cannot see the manage page controls or "Finalize Event":
1.  **Ownership**: You are likely visiting the page as a guest. Open the manage link you were given when you created the event. Any browser that opens it becomes an admin of that event.
2.  **No Manager Linked**: If you never registered a Telegram or Discord account as the event's manager, there is no stored account to send a login link to.
    *   **Fix**: From a browser that still has the manage link, use "Register for Magic Links" (Telegram) or "Recover with Discord (Magic Link)" on the management page.
3.  **Login link not arriving**: The "Send Magic Link" buttons allow one request per minute per manager account. Wait a minute and try again. On Telegram the recipient must have started a chat with the bot.

## Vote Rejected: "participant_not_owned"

Once a participant row has been claimed by a browser, editing it needs that browser's participant cookie, the same signed-in Telegram or Discord account, or the event's organizer. Choose **"Vote as a new participant"** to vote from this browser, or sign in with the account linked to the original vote.

## Database Locked

SQLite can only handle one writer at a time.
*   Ensure you don't have the database file open in a viewer (like DB Browser for SQLite) while the app is running.
*   If using Docker, ensure the volume permissions are correct (see the UID 1000 note above).
