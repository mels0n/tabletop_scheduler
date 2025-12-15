# Telegram Bot Setup Guide

Since TabletopTime is self-hosted, you need to provide your own Telegram Bot for notifications to work.

## 1. Create a Bot
1. Open Telegram and search for **@BotFather**.
2. Send the command `/newbot`.
3. Follow the prompts to name your bot (e.g., `MyGamingGroupSchedulerBot`).
4. **Copy the API Token** provided (it looks like `123456789:ABCdefGhI...`).

## 🚨 Important: Admin Permissions (Pinning)
For the bot to **Pin Messages** (like the event status dashboard), it must be an **Administrator** in your group with the "Pin Messages" permission enabled.

*   **Recommended Method:** Use the "Add Bot to Group" button in the Event Manager dashboard. This link automatically requests the specific admin permissions needed.
*   **Manual Method:** If you add the bot manually, go to Group Settings -> Administrators -> Add Admin -> Select Bot -> Enable "Pin Messages".

## 2. Configure Your Environment
Add this token to your `docker-compose.yml` or `.env` file:
```env
TELEGRAM_BOT_TOKEN=your_token_here
```

## 3. Deployment Modes (Polling vs Webhook)
TabletopTime supports two modes for the Telegram Bot. The app selects the mode based on your configuration.

### A. Polling (Default)
*   **Best for:** Local Development, Home Servers (Docker).
*   **How to use:** Do **NOT** set `NEXT_PUBLIC_BASE_URL`.
*   **Behavior:** The app connects out to Telegram to check for messages. No public domain or SSL required.

### B. Webhook (Zero Config)
*   **Best for:** Vercel, Cloud Hosting, or Self-Hosted with a Domain.
*   **How to use:** Set `NEXT_PUBLIC_BASE_URL` to your app's public URL (e.g., `https://scheduler.example.com` or `https://my-app.vercel.app`).
*   **Behavior:** The app automatically registers this URL with Telegram on startup. Telegram pushes messages to your server.
*   **Requirement:** The URL must be public and support HTTPS.

## 4. Using the Bot
1. Create an Event in TabletopTime.
2. Go to the **Manager Dashboard** for your event.
3. **Optional:** Click "Register for Magic Links" to securely link your Telegram account to the event (for recovery).
4. Click the **"Add Bot to Group"** button (or "Connect Telegram Notifications").
   - This will open Telegram and prompt you to add the bot as an Admin.
4. Once added, the bot will automatically detect the event link if you pasted it, OR you can simply paste the link now.
5. The bot will automatically post the event dashboard to the group.
6. Now, when you **Finalize** the event, the bot will post the result to the group and pin it!
