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

`NEXT_PUBLIC_BASE_URL` is **needed whenever a bot token is set, in every mode, polling included**. Every link the bot sends (login links, the connect dashboard, event links, reminders, recovery messages) is built from it. Hosted and Vercel deployments refuse to start without it; a self-hosted install starts, logs an error, and sends broken links until it is set. On a home server behind NAT, set it to the address your players use to reach the app (a LAN address such as `http://nas.local:3000` works if everyone is on that network). Polling is the self-host default, so no public URL is needed.

## 3. Deployment Modes (Webhook vs Polling)
TabletopTime supports two ways of receiving Telegram messages. Set `TELEGRAM_MODE` to choose one explicitly, or leave it unset and the app picks:

| `TELEGRAM_MODE` | Meaning |
|-----------------|---------|
| `webhook` | Telegram pushes updates to your server. |
| `polling` | Your server connects out to Telegram and asks for updates. |
| `off` | Telegram is disabled even if a token is set. |
| unset | With a token: `polling` on a self-hosted install, `webhook` when hosted (`NEXT_PUBLIC_IS_HOSTED=true`) or on Vercel. Without a token: `off`. A self-hosted install with a public HTTPS address sets `TELEGRAM_MODE=webhook` to use webhooks. |

Whichever mode you pick, every update goes through the same handler, and an update Telegram delivers twice is processed once.

### A. Webhook (recommended)
*   **Best for:** Vercel, cloud hosting, or any instance with a public HTTPS domain. The default when hosted or on Vercel; a self-hosted install opts in with `TELEGRAM_MODE=webhook`.
*   **Behavior:** On startup the app registers `<NEXT_PUBLIC_BASE_URL>/api/telegram/webhook` with Telegram (plus a short fingerprint query parameter that changes when the bot token changes), only if Telegram's current webhook differs. Telegram then pushes messages there, and the route rejects (401) any request without the secret token registered alongside it. After that check it always answers 200, so Telegram never redelivers an update the app has already handled. To force a re-registration, call `GET /api/telegram/setup` with `Authorization: Bearer <CRON_SECRET>`.
*   **Requirement:** The URL must be public and use HTTPS.

### B. Polling
*   **Best for:** Local development and home servers with no public domain.
*   **How to use:** Set `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_BASE_URL`. Polling is the default on a self-hosted install, so `TELEGRAM_MODE` can stay unset (or set it to `polling` to be explicit). Polling is not available on Vercel (the server refuses to start). The poller never deletes a webhook: if one is still registered for the bot, Telegram answers with a conflict and the log tells you to delete the webhook yourself or switch the mode.
*   **Behavior:** The app connects out to Telegram to check for messages, so Telegram never needs to reach your server and no public domain or SSL is required. Polling uses the same message handler as the webhook, so the bot behaves identically.
*   **Base URL:** Still required. It does not need to be public, but every link the bot sends points at it, so it must be an address your players can open.

## 4. Using the Bot
1. Create an Event in TabletopTime.
2. Go to the **Manager Dashboard** for your event.
3. **Optional:** Click "Register for Magic Links" in the Manager Recovery box. It opens the bot with a one-time code (valid 15 minutes) and registers your Telegram account as the event's manager, so you can get a login link by DM later if you lose the manage link.
4. Under **Connect Telegram Group**, click **"Add @YourBot to Group"**. This opens Telegram and prompts you to add the bot to a group as an admin with the Pin Messages and Change Info rights. Adding the bot does not connect anything by itself.
5. The manage page now shows a **connect command with a code**, for example `/connect Xk3pQ9mL2vB7nR 9f3a7c21`. Copy it and **send it in the group**.
6. The bot replies, connects the group to the event, posts the live dashboard, and pins it.
7. When you **Finalize** the event, the bot posts the result to the group and pins it.

The code is what proves you manage the event. It is tied to that one event and can be used once (after a group is connected, the manage page shows a new code). Pasting an event link, sending `/start <slug>`, or sending `/connect <slug>` without the code does **not** connect anything and never makes the sender a manager. The bot replies telling you to use the command shown on the manage page.

**Login links by DM.** Sending `/start login` to the bot in a private chat (the "Connect Telegram" pill on My Events opens exactly that) DMs you a 15-minute login link. In a group the bot refuses and asks you to message it privately, so a login link is never posted where others can read it.

## 5. What the Bot Sends

**In a connected group:**
*   The connect confirmation and the live dashboard, pinned. The dashboard is edited in place on every vote, slot change, location change and finalize. It is reposted (and the old one unpinned) only when the old message is gone; a temporary Telegram error never triggers a repost.
*   A notice asking you to promote the bot to admin with Pin Messages, if it could not pin the dashboard.
*   A short "updated their availability" post when someone votes (it names the voter). Each person is announced at most once per `VOTE_ANNOUNCE_COOLDOWN_MINUTES` (default 60 minutes; `0` announces every vote); the pinned dashboard always shows the latest votes.
*   A short post when a time option is added (by the organizer or suggested by a player), changed, or removed.
*   The finalize announcement.
*   Cancel and delete announcements.
*   Voting reminders and session reminders, only the types the organizer turned on. Voting reminders stop once the event reaches its minimum player count or no future time option is left. Session reminders go out 2 hours, 1 day, or 2 days before each finalized session, whichever lead time the organizer picked.

**By direct message** (only to people who have started a chat with the bot):
*   Login links you request with `/start login`, and the manager login link from the manage page or the "Lost Manager Link?" form.
*   Waitlist promotion, and a notice when the organizer removes you from an event.
*   Finalize results for events you joined: whether you are in or on the waitlist (one-shots and campaigns).
*   Quorum alerts to the organizer, when the event first becomes viable and when it becomes a perfect match.

Anyone signed in on My Events can turn bot direct messages off for their account. Login links and manager login links are always sent, because you asked for them. All user text in bot messages (titles, names, locations) is escaped, so it cannot inject formatting or links.
