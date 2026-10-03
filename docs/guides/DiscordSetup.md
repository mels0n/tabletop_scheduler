# Discord Bot Setup Guide

TabletopTime integrates with Discord to provide channel notifications, a live pinned dashboard, reminders, and easier manager login/recovery.

## 1. Create a Discord App (Host Only)
*Note: This step is done once by the person hosting the TabletopTime instance. Event Managers do NOT need to create their own bots; they just invite yours. On tabletoptime.us the app already exists.*

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it (e.g., `TabletopTime`).
3. Copy the **Application ID**. This is your `DISCORD_APP_ID`.

## 2. Configure the Bot
1. Go to the **Bot** tab in the sidebar.
2. Click **Reset Token** to generate a token. This is your `DISCORD_BOT_TOKEN`.
3. Leave every **Privileged Gateway Intent** switched **off**. TabletopTime talks to Discord over its REST API only and never opens a gateway connection, so it does not need the Message Content, Server Members, or Presence intents. Do not enable them.
4. Ensure **"Public Bot"** is checked (unless you only want it on your own server, but Public makes it easier to invite).

## 3. Configure OAuth2 (Login & Invites)
1. Go to the **OAuth2** tab in the sidebar.
2. Setup **Redirects**:
   - Add your app's callback URL: `https://your-domain.com/api/auth/discord/callback`
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

# Required whenever a bot token is set (OAuth redirects and every bot link)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

All Discord variables are optional. Without them the Discord buttons are hidden and the rest of the app works normally.

## 5. Using the Integration
1. Create an Event in TabletopTime.
2. Go to the **Manager Dashboard** (`/manage`). You must be signed in as the event's manager.
3. Scroll to **Connect Discord Notifications**.
4. Click **Connect Discord Server**.
   - This will open a window to invite the bot to your server.
   - You will be asked to **Authorize** the following permissions (required for the bot to function):
     - **View Channels**
     - **Send Messages**
     - **Manage Messages** (Critical for pinning the dashboard)
     - **Embed Links**
     - **Read Message History**
5. Once invited, you will be redirected back to the dashboard.
6. A **Channel Picker** will appear. It lists channels only for the server you just added the bot to, and only while you are signed in as the event's manager. Select the channel where you want updates (e.g., `#scheduling`).
7. Click **Save**. The bot posts the event dashboard to that channel and pins it.

### What the Bot Posts

**In the connected channel:**
*   **Live dashboard:** The pinned message is edited in place when people vote. If Discord says the message is gone (it was deleted), the bot posts and pins a fresh one and unpins the old one. A temporary Discord error does not trigger a repost.
*   **Vote updates:** A short "updated their availability" post when someone votes. It names the voter. Availability updates are announced at most once per hour per person; the pinned dashboard always shows the latest votes. Self-hosters can change the window with `VOTE_ANNOUNCE_COOLDOWN_MINUTES`.
*   **Slot changes:** A short message when the organizer adds, changes, or removes a time option.
*   **Location updates:** A short message when the organizer sets or changes the location.
*   **Finalize announcement:** The result, once the organizer finalizes.
*   **Cancel and delete announcements:** A notice when the organizer cancels or deletes the event.
*   **Reminders:** Voting reminders and session reminders, when the organizer enables them on the manage page. Session reminders go out 2 hours, 1 day, or 2 days before each finalized session, whichever lead time the organizer picked.

**By direct message** (only to people who linked their Discord account):
*   A magic login link you request.
*   Waitlist promotion and removal notices.
*   Finalize results for events you joined.
*   Quorum alerts to the organizer.

Bot messages never ping `@everyone` or roles.

### Troubleshooting
*   **"Missing Access" (Error 50001)**: This means the bot cannot see or post in the specific channel you selected.
    *   **Fix**: Go to the Channel Settings -> Permissions.
    *   Add the Bot (or its role) and explicitly grant **View Channel** and **Send Messages**.
*   **Bot not in list**: If you don't see the bot in the channel picker, ensure you have invited it to the server using the "Connect Discord Server" button, and that you are signed in as the event's manager.
*   **Channel list is empty after a while**: The channel picker is tied to the server you added the bot to, and the permission to browse it lasts one hour. Click "Connect Discord Server" again.
