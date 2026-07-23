# Understanding Magic Links

TabletopTime uses a **passwordless** authentication system. Instead of usernames and passwords, we use secure "Magic Links" sent to your Telegram to verify your identity.

There are three main ways to use these links within the application, plus two related features (per-event sync badges and vote-time linking) that keep your identity attached to events without needing a fresh link every time.

## 1. Sync & Recover (My Events)
*Best for: Logging in to view all your events at once.*

If you are on a new device or your cookies have been cleared, you can recover access to your entire event history via the **My Events** (Profile) page.

The header of that page always shows two status pills, one per platform:
*   **Already synced**: a solid green **"Telegram Synced"** or blurple **"Discord Synced"** pill.
*   **Not synced yet**: a dashed **"Connect Telegram"** pill (deep-links straight to the bot, which DMs you a magic login link) or **"Connect Discord"** pill (starts the OAuth flow). Click either as a shortcut instead of the handle form below.

1.  Navigate to the **My Events** page (click the User icon in the top right).
2.  Scroll down to the **"Sync & Recover"** section.
3.  Enter your **Telegram Handle** (e.g., `@YourHandle`).
4.  Click **Sync My Events**.
5.  The bot will send a **Global Magic Link** to your Telegram DMs. Click it to log in.
6.  This will:
    *   **Restore your Event List**: All events you manage or voted on will appear on your dashboard.
    *   **Restore your Voting Identity**: You will instantly regain "Voted" status on all events, allowing you to edit your previous votes.

    *   **Safe Merge**: This adds to your existing local history without deleting any anonymous events you may have visited on this device.

#### Discord Users
1.  Navigate to the **My Events** page.
2.  In the "Sync & Recover" section, look for the **Discord** panel.
3.  Enter your Discord Username.
4.  *Note: This only works if you have previously clicked "Log in with Discord" on a voting page.*
5.  The bot will DM you a link. Click it to hydrates your browser with your Discord identity.

### Per-Event Sync Badges
*Best for: seeing at a glance which events will follow you across devices, and fixing the ones that won't.*

Every card on the **My Events** page carries its own badge, independent of the header pills:

*   **"Telegram Synced" / "Discord Synced"** (colored, same style as the header pills): this event's participant row is stamped with your verified identity, so it will always show up here, on any device.
*   **"This Device Only"** (gray): this event only exists in this browser's local history. It hasn't been linked to a synced identity yet.
*   **"Manager"** (indigo, static dot): shown on events you manage, marking your role. It's independent of the sync badges above; a managed event with no linked participant identity yet still shows just "Manager", never "This Device Only", since it's already tied to the event on the server through your manager record.

The badges are clickable:
*   Click a gray **"This Device Only"** badge to open a small menu offering to link the event to whichever platform(s) your browser is synced with.
*   Click a colored badge to open a menu offering to **unlink** it.

Two guardrails apply to both actions:
*   **You must have voted on the event.** Linking stamps your identity onto your own participant row for that event, so if there's no row yet (or your browser doesn't remember one), the menu item is disabled with a "Vote on this event first to link it" hint.
*   **You can only unlink yourself.** A row already claimed by someone else's verified identity can't be relinked to you, and unlinking only clears *your own* identity from a row, never someone else's.

### Linking While You Vote
*Best for: getting a new vote linked automatically instead of fixing it afterward.*

If your browser is already synced when you vote, the vote form shows a small **"Will link to Telegram/Discord"** indicator next to a checkbox. It's checked by default, meaning your new (or updated) vote will automatically be stamped with your synced identity, no extra steps required. Uncheck it if you'd rather this particular vote stay anonymous/device-only; opting out skips all identity attachment for that submission.

If you vote *before* syncing, or you opted out and change your mind later, the event page itself shows a dismissible banner ("This browser is synced with Telegram/Discord, link this event so it shows on all your devices?") whenever your browser is synced but your participant row on that event isn't linked yet. Click the platform button in the banner to link it on the spot, same as the profile-page badges.

## 2. Manager Recovery (Manage Page)
*Best for: Quickly switching devices for a specific event.*

If you are viewing your event's **Manage Page** and want to switch to your phone (or share admin access with a co-host):

1.  On the Manage Page, look for the **Manager Recovery** box.
2.  Click **"Send Magic Link"** (Telegram or Discord).
3.  The bot will send a specific **Event Admin Link** to your DMs.
4.  Clicking this link grants admin access *only* for that specific event.

## 3. Lost Manager Link? (Vote Page)
*Best for: Recovering access when you are locked out.*

If you are viewing an event you created but are seeing it as a *Participant* (no admin controls):

1.  Scroll to the bottom of the Vote Page.
2.  Click the link: **"Are you the organizer? Manage this event"**.
3.  If you are locked out, you will see a small link: **"Lost Manager Link?"**.
4.  Click it and enter the **Telegram Handle** you used when creating the event (Discord recovery coming soon for this specific flow).
5.  If the handle matches our records, the bot will send a recovery link to your DMs.

---

**Security Note**: All Magic Links are valid for **15 minutes**. If you accidentally close the window, you can click the same link again within that time. Do not share them.

---

## Technical Implementation

### Browser Cache & Storage

Our authentication system relies on two layers of browser storage to keep you logged in and remember your preferences:

1.  **Cookies (Server Auth)**:
    *   **User Identity**: `tabletop_user_chat_id` (Telegram) and `tabletop_user_discord_id` (Discord). These HTTPOnly, Secure cookies persist for **400 days** (browser maximum) to ensure you are rarely logged out.
    *   **Event Admin**: `tabletop_admin_[slug]` (HTTPOnly, Secure, 400 days). This grants administrative rights to a specific event.

    > **Sliding Session:** Every time you visit a management page or your profile, the system automatically refreshes your cookie's expiration date to a full 400 days from that moment. As long as you visit the site at least once a year, your session will effectively last forever.

2.  **LocalStorage (Client Cache)**:
    *   **User Preference Cache**: `tabletop_username` & `tabletop_telegram` are stored in your browser after you vote. The next time you visit *any* event on Tabletop Scheduler, these fields are auto-filled so you don't have to type them again.
    *   **Session Cache**: `tabletop_participant_[eventId]` remembers your specific Voter ID for a particular event. This allows you to return to an event and edit your votes immediately, even if your global login cookie has expired.

### Telegram Identity Linking

When you enter a Telegram handle (e.g., `@YourName`) and request a Magic Link:

1.  **Normalization**: The system converts your input to lowercase and removes the `@` (e.g., `@YourName` -> `yourname`).
2.  **Lookup**: It searches the database for any Participant or Manager record that matches this handle.
3.  **Verification**:
    *   **If you have used the bot before**: We have your numeric `Chat ID`. The system generates a token and sends the link directly to your Telegram DMs.
    *   **If you are new**: We only know your text handle, not your numeric ID. The system cannot DM you yet. You will be prompted to "Start" the bot to establish this connection.

**Passive linking on vote:** you don't have to run the recovery flow above just to keep a numeric Chat ID attached to your handle. Every time you vote with a Telegram handle, the system also checks (a) other Participant rows with that same handle that already have a verified Chat ID, and (b) whether you manage a *different* event under that handle (its `managerChatId` counts too). Handles are matched with or without a leading `@`, so `pyaniz` and `@pyaniz` resolve to the same person. If either check finds a match, your new (or existing) participant row self-heals its Chat ID automatically, no DM required.
