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

## 2. Manager Recovery (Manage Page)
*Best for: Quickly switching devices for a specific event.*

If you are viewing your event's **Manage Page** and want to switch to your phone (or share admin access with a co-host):

1.  On the Manage Page, look for the **Manager Recovery** box.
2.  Click **"Send Magic Link"**.
3.  The bot will send a specific **Event Admin Link** to your Telegram DMs.
4.  Clicking this link grants admin access *only* for that specific event.

## 3. Lost Manager Link? (Vote Page)
*Best for: Recovering access when you are locked out.*

If you are viewing an event you created but are seeing it as a *Participant* (no admin controls):

1.  Scroll to the bottom of the Vote Page.
2.  Click the link: **"Are you the organizer? Manage this event"**.
3.  If you are locked out, you will see a small link: **"Lost Manager Link?"**.
4.  Click it and enter the **Telegram Handle** you used when creating the event.
5.  If the handle matches our records, the bot will send a recovery link to your DMs.

---

**Security Note**: All Magic Links are valid for **15 minutes**. If you accidentally close the window, you can click the same link again within that time. Do not share them.
