# Telegram Bot Setup Guide

If you run your own TabletopTime instance, you provide your own Telegram bot. (On tabletoptime.us the bot is already set up; skip to section 4.)

## 1. Create a Bot
1. Open Telegram and search for **@BotFather**.
2. Send the command `/newbot`.
3. Follow the prompts to name your bot (e.g., `MyGamingGroupSchedulerBot`).
4. **Copy the API Token** provided (it looks like `123456789:ABCdefGhI...`).

## Important: Admin Permissions (Pinning)
For the bot to **Pin Messages** (like the event status dashboard), it must be an **Administrator** in your group with the "Pin Messages" permission enabled.

*   **Recommended Method:** Use the "Add Bot to Group" button in the Event Manager dashboard. This link automatically requests the specific admin permissions needed.
*   **Manual Method:** If you add the bot manually, go to Group Settings -> Administrators -> Add Admin -> Select Bot -> Enable "Pin Messages".

## 2. Configure Your Environment
Add the token and your public URL to your `docker-compose.yml` or `.env` file:
```env
TELEGRAM_BOT_TOKEN=your_token_here
NEXT_PUBLIC_BASE_URL=https://scheduler.example.com
```

`NEXT_PUBLIC_BASE_URL` is **required whenever a bot token is set, in every mode, polling included**. Every link the bot sends (login links, the connect dashboard, event links, reminders, recovery messages) is built from it, and the server refuses to start without it. On a home server behind NAT, set it to the address your players use to reach the app (a LAN address such as `http://nas.local:3000` works if everyone is on that network) and choose polling explicitly, as described below.

## 3. Deployment Modes (Webhook vs Polling)
TabletopTime supports two ways of receiving Telegram messages. Set `TELEGRAM_MODE` to choose one explicitly, or leave it unset and the app picks:

| `TELEGRAM_MODE` | Meaning |
|-----------------|---------|
| `webhook` | Telegram pushes updates to your server. |
| `polling` | Your server connects out to Telegram and asks for updates. |
| `off` | Telegram is disabled even if a token is set. |
| unset | `webhook` when a token is set (the base URL is then required anyway); `off` without a token. Polling is never picked automatically, so set `TELEGRAM_MODE=polling` to use it. |

### A. Webhook (recommended)
*   **Best for:** Vercel, cloud hosting, or any instance with a public HTTPS domain.
*   **Behavior:** On startup the app registers `NEXT_PUBLIC_BASE_URL` with Telegram, only if Telegram's current webhook differs. Telegram then pushes messages to `/api/telegram/webhook`, which checks a secret token on every request.
*   **Requirement:** The URL must be public and use HTTPS.

### B. Polling
*   **Best for:** Local development and home servers with no public domain.
*   **How to use:** Set `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BASE_URL`, and `TELEGRAM_MODE=polling`. Polling is not available on Vercel.
*   **Behavior:** The app connects out to Telegram to check for messages, so Telegram never needs to reach your server and no public domain or SSL is required. Polling uses the same message handler as the webhook, so the bot behaves identically.
*   **Base URL:** Still required. It does not need to be public, but every link the bot sends points at it, so it must be an address your players can open.

## 4. Using the Bot
1. Create an Event in TabletopTime.
2. Go to the **Manager Dashboard** for your event.
3. **Optional:** Click "Register for Magic Links" to securely link your Telegram account to the event (for recovery).
4. Click the **"Add Bot to Group"** button (or "Connect Telegram Notifications"). This opens Telegram and prompts you to add the bot as an Admin.
5. The manage page now shows a **connect command with a code**, for example `/connect a1b2c3d4 9f3a7c21`. Copy it and **send it in the group**.
6. The bot replies, connects the group to the event, posts the live dashboard, and pins it.
7. When you **Finalize** the event, the bot posts the result to the group and pins it.

The code is what proves you manage the event. It is tied to that one event, so pasting an event link, or sending `/connect <slug>` without the code, does **not** connect anything. The bot replies telling you to use the command shown on the manage page.

## 5. What the Bot Sends

**In a connected group:** the live dashboard, slot changes, the finalize announcement, and voting or session reminders (only the reminder types the organizer turned on).

**By direct message** (only to people who have started a chat with the bot): magic login links you request, waitlist promotion and removal notices, finalize results for events you joined, and quorum alerts to the organizer.
