# Understanding Magic Links

TabletopTime uses a **passwordless** authentication system. Instead of usernames and passwords, we use secure "Magic Links" sent to your Telegram to verify your identity.

There are three main ways to use these links within the application:

## 1. Sync & Recover (My Events)
*Best for: Logging in to view all your events at once.*

If you are on a new device or your cookies have been cleared, you can recover access to your entire event history via the **My Events** (Profile) page.

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
