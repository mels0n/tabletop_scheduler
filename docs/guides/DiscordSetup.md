# Discord Bot Setup Guide

TabletopTime integrates with Discord to provide channel notifications, a live pinned dashboard, and easier manager login/recovery.

## 1. Create a Discord App (Host Only)
*Note: This step is done once by the person hosting the TabletopScheduler instance. Event Managers do NOT need to create their own bots; they just invite yours.*

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it (e.g., `TabletopScheduler`).
3. Copy the **Application ID**. This is your `DISCORD_APP_ID`.

## 2. Configure the Bot
1. Go to the **Bot** tab in the sidebar.
2. Click **Reset Token** to generate a token. This is your `DISCORD_BOT_TOKEN`.
3. Scroll down to **Privileged Gateway Intents**.
4. **Enable "Message Content Intent"**. This is required for the bot to function correctly (even though we mostly send messages, we need this for certain API interactions).
5. Ensure **"Public Bot"** is checked (unless you only want it on your own server, but Public makes it easier to invite).

## 3. Configure OAuth2 (Login & Invites)
1. Go to the **OAuth2** tab in the sidebar.
2. Setup **Redirects**:
   - Add your app's callback URL: `https://your-domain.com/api/auth/discord/callback`
   - For local development, add: `http://localhost:3000/api/auth/discord/callback`
   - For local development, add: `http://localhost:3000/api/auth/discord/callback`
3. **Reset the Client Secret**:
   - The Client Secret is hidden by default.
   - Click the **Reset Secret** button.
   - If prompted, enter your 2FA code.
   - **Copy the new secret immediately** and save it as your `DISCORD_CLIENT_SECRET`. You won't be able to see it again!

## 4. Configure Your Environment
Add these variables to your `.env` or `docker-compose.yml`:

```env
# Discord Configuration
DISCORD_APP_ID=your_application_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token

# Required for OAuth Redirects
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## 5. Using the Integration
1. Create an Event in TabletopTime.
2. Go to the **Manager Dashboard** (`/manage`).
3. Scroll to **Connect Discord Notifications**.
4. Click **Connect Discord Server**.
   - This will open a window to invite the bot to your server.
   - This will open a window to invite the bot to your server.
   - You will be asked to **Authorize** the following permissions (required for the bot to function):
     - **View Channels**
     - **Send Messages**
     - **Manage Messages** (Critical for pinning the dashboard)
     - **Embed Links**
     - **Read Message History**
5. Once invited, you will be redirected back to the dashboard.
6. A **Channel Picker** will appear. Select the channel where you want updates (e.g., `#scheduling`).
7. Click **Save**. The bot will post a "Beep Boop!" message and pin a live dashboard to that channel.

### Features
*   **Live Dashboard:** The pinned message updates automatically when people vote.
*   **Notifications:** The bot posts new messages when creating, updating, or finalizing events.
*   **Manager Recovery:** If you lose your manager session, you can click "Recover with Discord" on the event page to instantly log back in using your Discord account.
