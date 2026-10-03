# Understanding Magic Links

TabletopTime has no accounts and no passwords. When it needs to know who you are, a bot proves it: the Telegram or Discord bot sends a short-lived **magic link** to your direct messages, and opening it signs this browser in as that account. Discord users can also sign in directly with Discord's own login screen.

A typed name or handle is never proof of identity. Nothing on this page links an account because someone typed a handle into a form.

## 1. Sync this browser (My Events)
*Best for: seeing all your events on a new device, and having your votes follow you.*

Open **My Events** (the user icon in the top right, `/profile`). The header shows one pill per platform:

*   **Not synced yet**: a dashed **"Connect Telegram"** pill opens the bot with `/start login`, and the bot DMs you a magic login link. A dashed **"Connect Discord"** pill starts Discord sign-in.
*   **Synced**: a solid green **"Telegram Synced"** or blurple **"Discord Synced"** pill. Click it to **disconnect this browser** from that platform; your events and votes are kept and you can reconnect any time.

Once this browser is synced, My Events lists every event you manage or voted on with that account, and restores your voting identity on them so you can edit your votes from this device.

You can also request a login link at any time by sending `/start login` to the Telegram bot in a private chat. The bot never sends a login link in a group.

### Per-Event Sync Badges
*Best for: seeing at a glance which events will follow you across devices, and fixing the ones that won't.*

Every card on **My Events** carries its own badge, independent of the header pills:

*   **"Telegram Synced" / "Discord Synced"** (colored, same style as the header pills): this event's participant row is stamped with your verified identity, so it will always show up here, on any device.
*   **"This Device Only"** (gray): this event only exists in this browser's local history. It hasn't been linked to a synced identity yet.
*   **"Manager"** (indigo, static dot): shown on events you manage, marking your role. It's independent of the sync badges above; a managed event with no linked participant identity yet still shows just "Manager", never "This Device Only", since it's already tied to the event on the server through your manager record.

The badges are clickable:
*   Click a gray **"This Device Only"** badge to open a small menu offering to link the event to whichever platform(s) your browser is synced with.
*   Click a colored badge to open a menu offering to **unlink** it.

Two guardrails apply to both actions:
*   **You must have voted on the event.** Linking stamps your identity onto your own participant row for that event, so if there's no row yet (or your browser doesn't remember one), the menu item is disabled with a hint to vote first.
*   **You can only unlink yourself.** A row already claimed by someone else's verified identity can't be relinked to you, and unlinking only clears *your own* identity from a row, never someone else's.

### Linking While You Vote
*Best for: getting a new vote linked automatically instead of fixing it afterward.*

If your browser is already synced when you vote, the vote form shows a small **"Will link to Telegram/Discord"** indicator next to a checkbox. It's checked by default, meaning your new (or updated) vote is stamped with your synced identity, no extra steps required. Uncheck it if you'd rather this particular vote stay anonymous and device-only; opting out skips all identity attachment for that submission.

If you vote *before* syncing, or you opted out and change your mind later, the event page shows a dismissible banner whenever your browser is synced but your participant row on that event isn't linked yet. Click the platform button in the banner to link it on the spot, same as the profile-page badges.

### Direct messages and unlinking
*   **Direct messages from the bot.** While a platform is synced, My Events shows an On/Off switch for bot direct messages on that platform. It follows your account, not the browser. Login links you ask for are always sent.
*   **Unlink everywhere.** The privacy page under My Events can remove a platform identity from every event you voted on or manage. This also ends magic-link recovery through that platform for events you manage.

## 2. Manager Login Link (Manage Page)
*Best for: switching devices, or getting back in on a phone, for an event you run.*

The manage page has a **Manager Recovery** box for each platform.

1.  **Register first.** Click **"Register for Magic Links"** (Telegram) or **"Recover with Discord (Magic Link)"** (Discord). This saves your Telegram or Discord account as the event's manager. Only the event's admin can do this: Telegram registration uses a one-time code that is valid for 15 minutes, and Discord registration only happens while your browser holds the event's admin link.
2.  **Send a link.** Click **"Send Magic Link (Telegram DM)"** or **"Send Magic Link (Discord DM)"**. The bot DMs a login link to every platform the manager has linked, one link per platform, each sent only on its own platform.
3.  Opening the link signs that browser in as the manager's account, which gives it admin access to every event that account manages.

The admin token itself is never changed or re-sent, so asking for a link can never lock the organizer out. Links can be requested once a minute per manager account.

## 3. Lost Manager Link? (Event Page)
*Best for: recovering access when you have no browser with the manage link.*

1.  Scroll to the bottom of the event page and find **"Are you the organizer?"**.
2.  Click **"Lost Manager Link?"**.
3.  Choose **Telegram** or **Discord**, and enter the Telegram handle or Discord username linked to the event.
4.  If it matches the event's stored manager, the bot sends a login link to **that stored account's** DMs. Typing someone else's handle cannot send a link anywhere else.

This only works if a Telegram or Discord account was registered as the manager (step 1 of the previous section, or creating the event while your browser was already synced). Without one there is nowhere to send a link, and the event can only be managed through its original manage link.

---

**Security Note**: Login links are valid for **15 minutes**. Opening the same link again within that window still works, which keeps chat-app link previews from using it up before you click. Do not share them.

---

## Technical Implementation

### Browser Cache & Storage

1.  **Cookies (Server Auth)**:
    *   **User Identity**: `tabletop_user_chat_id` (Telegram) and `tabletop_user_discord_id` (Discord). They hold your numeric platform ID with an HMAC signature, are HttpOnly, `SameSite=Lax`, `Secure` in production, and last **400 days** (the browser maximum). An unsigned or tampered value is ignored and deleted. `tabletop_user_telegram_name` and `tabletop_user_discord_name` carry a display name next to them and are readable by page scripts.
    *   **Event Admin**: `tabletop_admin_<slug>` (HttpOnly, 400 days) holds the event's admin token, which is checked against the stored hash on every use.
    *   **Participant**: `tabletop_participant_<slug>` (signed, HttpOnly) proves this browser created a participant row on that event. Editing that row later needs this cookie, a matching linked identity, or the organizer.

    > **Sliding Session:** Every time you open an event page, a manage page or My Events, the identity and admin cookies are re-issued with a fresh 400-day expiry. As long as you visit at least once a year, your session effectively never ends.

2.  **LocalStorage (Client Cache)**:
    *   **User Preference Cache**: `tabletop_username` and `tabletop_telegram` are stored after you vote and pre-fill the vote form on other events.
    *   **Event history**: `tabletop_history` lists the events this browser has visited, for My Events.
    *   **Voter ID**: `tabletop_participant_<eventId>` remembers your participant id for an event, so the page shows your votes when you come back. It is not proof of ownership on its own: an edit also needs the participant cookie, a linked identity, or the organizer.

### No linking by typed handle

A Telegram handle typed into the voting form is shown in group posts in place of your name, and that is all. It never attaches a Chat ID to your participant row and never matches you to other events under the same handle. Your identity is linked only when you sign in through the bot (a magic link it DMed you) or with Discord. That sign-in sets a signed cookie in your browser, and votes cast from that browser are tied to your verified account unless you untick the option to link it.
