# User Guide

Welcome to **Tabletop Time**, the privacy-focused scheduler for your gaming sessions. This guide explains how to use each page of the application.

## 1. Creating an Event
**Page:** `/new` (Accessible via "Start Scheduling" on the home page)

Use this form to set up a new session.
- **Event Title**: The name of your session (e.g., "D&D Campaign Session 4").
- **Description**: Optional details about what you're playing or what players need to bring.
- **Minimum Players**: The logic engine uses this to highlight "Valid" slots where enough people are available.
- **Propose Time Slots**: Click "Add Time Slot" to pick dates and times. You can add as many as you like.

**Action**: Click "Create Event & Get Link" to generate your unique event dashboard.

---

## 2. Event Dashboard (Voting)
**Page:** `/e/[slug]`

This is the public page you share with your players.
- **Event Details**: Shows title, description, and status.
- **Share**: Use the "Copy Link" button to send this page to your group.
- **Voting Interface**:
    - **Name**: Enter your name (required) and Telegram handle (optional, helps with notifications).
    - **Grid**: Mark your availability for each slot:
        - ✅ **Yes**: I can play.
        - ⚠️ **If Needed**: Yes, but not my preference for day.
        - ❌ **No**: I cannot play.
    - **Suggest a Time**: If none of the proposed times work for you, click "Suggest a Time" to add a new option for everyone to vote on.
    - **Submit**: Saves your votes. You can edit them later if you revisit the page on the same device.
- **Best Slot**: The app automatically highlights the slot with the most "Yes" votes that meets the minimum player count.
- **Identity Linking**: If your browser is synced with Telegram or Discord (see **[Magic Links](MagicLinks.md)**), the vote form shows a "Will link to Telegram/Discord" indicator with an opt-out checkbox, checked by default. Leave it checked and this vote is automatically stamped with your synced identity so it follows you across devices; uncheck it to keep this particular vote anonymous. If you're synced but a past vote on this event isn't linked yet, a dismissible banner near the top of the page offers to link it.

---

## 3. Managing Your Event
**Page:** `/e/[slug]/manage` (Accessible via the footer link "Manage Event" or the link given after creation)

As the organizer, you use this page to control the event.
- **Manager Controls**:
    - **Setup Recovery**: If you haven't connected a group yet, click "Register for Magic Links" to let the bot capture your details. (See **[Magic Links](../docs/MAGIC_LINKS.md)** for details).
    - **DM Me Manager Link**: Once connected, use this to get a private login link sent to your Telegram DMs.
    - **Bot Status**: Shows if the Telegram bot is connected to your group.
- **Manage Event Details**:
    - **Participants**: You can remove attendees if they can no longer make it. If the event is finalized and full, removing an ACCEPTED participant will automatically promote the next person on the waitlist.
    - **Time Slots**: You can add, edit, or delete time slots dynamically to adjust the options available for voting. (Note: Modifying slots is disabled once the event is finalized).
- **Finalize Event**:
    - Select the winning time slot.
    - Pick a **Host** from the list of attendees (optional).
    - Enter a **Location** (e.g., "John's House" or a URL).
    - **Confirm**: This locks the event, stops voting, and sends a notification to the group.
- **Danger Zone**:
    - **Cancel Event**: (If Finalized) Marks the event as cancelled, notifies the group, but keeps the page viewable for 1 day.
    - **Delete Event**: (If Draft) Permanently removes all data immediately.

---

## 4. Finalized Event View
**Page:** `/e/[slug]` (After finalization)

Once finalized, the voting grid disappears.
- **Status**: Shows "FINALIZED" with the chosen date and time.
- **Location**: Displays the location.
- **Host**: Shows who is hosting.
- **Add to Calendar**: Download an `.ics` file to add the session to Outlook, Google Calendar, or Apple Calendar.

---

## 5. Telegram Integration
To get notifications in your group chat:
1.  **Add Bot**: Add the bot (username provided on the dashboard) to your Telegram group.
    - *Tip*: Give the bot **Admin rights** (specifically "Pin Messages") so it can keep the event status pinned to the top of the chat.
2.  **Connect**: Paste the **Event Link** into the group chat.
3.  **Confirmation**: The bot will reply and pin the event dashboard.
4.  **Updates**: The bot will notify the group when:
    - People vote.
    - The event is finalized (updates the pin).
    - The event is cancelled.

---

## 6. My Events (Profile)
**Page:** `/profile`

Your personal history of events.
- **Local History**: This page tracks events you've visited or created on this device.
- **Connect Pills**: The header shows a solid "Telegram Synced" / "Discord Synced" pill per platform you're already connected to, or a dashed "Connect Telegram" / "Connect Discord" pill (deep-link to the bot / OAuth) when you're not.
- **Sync**: Use the "Sync & Recover" tool to merge events from your Telegram or Discord account.
- **Per-Event Badges**: Each event card carries its own badges: a colored "Telegram Synced" / "Discord Synced" badge means that event's vote is tied to your verified identity, while a gray "This Device Only" badge means it only lives in this browser's local history. Click a gray badge to link the event to a synced platform, or a colored badge to unlink it. Linking requires you to have voted on that event, and you can only unlink your own identity.
- **Manager Badge**: Events you manage also show a separate indigo "Manager" badge marking your role there. It's independent of the sync badges, a managed event with no linked participant identity shows just "Manager" (not "This Device Only", since it's already tied to the event on the server).
- **Status**: Quickly see if events are Draft, Finalized, or Cancelled.
- **Cleanup**: The list automatically removes events that have been deleted from the server.

---

## 7. Campaign Events (Multi-Session Scheduling)

### When to Use Campaign Mode

Campaign mode is designed for any group that needs to schedule **multiple sessions of the same series** in one go — not just a single game night. Good use cases include:

- **D&D or TTRPG campaigns** — lock in a run of sessions (e.g. six Fridays) so the whole group can plan ahead.
- **Legacy board game series** — Pandemic Legacy, Gloomhaven, and similar games where the same players need to show up repeatedly.
- **Recurring game night blocks** — schedule the next month of sessions while everyone has the availability poll open.

If you only need to find a date for a single session, a standard **One-Shot** event is simpler and works exactly as before.

---

### Creating a Campaign Event

**Page:** `/new`

The event creation page shows two cards at the top: **One-Shot Session** and **Campaign / Series**. Hover over either card for a tooltip describing the difference. Selecting **Campaign / Series** reveals an additional field:

- **Minimum Sessions**: The fewest number of sessions you intend to lock in (defaults to 4). This is used as a soft target during finalization — you will see a warning if you finalize with fewer sessions than this number, but it does not block the action.

The slot picker label also changes to **"Add candidate dates"** as a reminder that you are collecting options, not committing to specific dates yet. Add as many candidates as you like — more options give the algorithm more combinations to work with.

To create a Campaign event via the API, set `eventType: "CAMPAIGN"` and include `minSessions` in the request body.

---

### What Voters See

The voting interface works the same way as a standard event. Players mark each candidate date as **Yes**, **If Needed**, or **No**. On a Campaign event, the voting page shows a **Campaign** badge next to the event title and displays an informational banner:

> "This is a multi-session campaign. Vote on every date you're available — the organizer will lock in multiple sessions."

Players do not need to take any special action — they simply vote on every slot they can make.

---

### Finalization: Grouped View and Inline Selection

**Page:** `/e/[slug]/manage`

Campaign finalization happens entirely inline on the manage page — there is no separate modal. The dashboard displays candidate dates grouped by **shared player availability**:

**How groups are formed:**
- Players are grouped by the set of dates they can all attend together (pairwise intersection of YES/If-Needed votes).
- Groups are ordered by: groups that meet the Minimum Sessions count first, then by most players (up to the event's max player cap), then by most dates.

**Reading a group header:**
Each group header shows:
- **Player pills** — green for YES votes, yellow for If Needed.
- A **Quorum** or **Low T/O** badge indicating whether the group meets the minimum player count.
- A **player count ratio** (e.g. `4/4`) showing players in the group vs. the max player cap.
- The number of candidate dates the group can attend.

**Reading individual date rows:**
Each date within a group shows two rows:
- **Row 1:** Date/time + the core player pills (same players shown in the header).
- **Row 2:** "also free:" + dimmed pills for extra players who are available on this specific date but are not part of the core group. Click an extra player pill to toggle them into the session.
- Per-date badges: **Host ✓** (indigo) if a volunteer host is available on that date, or **No Host** (orange) if not.

A banner above the groups reads: *"Click a group to select it and finalize."*

---

### Completing Finalization

1. **Click a group header** — the group enters "Selecting" mode with an indigo border. All dates in the group are pre-ticked.
2. **Uncheck any dates** you want to exclude using the checkboxes that appear on each row. Extra players you toggled on remain selected.
3. A **finalization panel** expands at the bottom of the selected group with:
   - **Host selector** — radio pills listing players who volunteered to host and are available on at least one checked date.
   - **Location input** — free-text field for an address or venue name.
   - **"Confirm X Sessions" button** — X updates live as you check/uncheck dates.
4. Click **Confirm** to lock all checked sessions simultaneously.

If the number of checked sessions is below your Minimum Sessions count, finalization still succeeds but the API response includes a non-blocking `warning` field.

---

### After Finalization

The finalized campaign view shows:
- A **numbered session list** with each confirmed date/time and per-session calendar buttons: Google Calendar, Outlook, and `.ics` download.
- A **Host and location card**.
- A footer note: *".ics downloads all N sessions at once"* — a single file you can import once to add every session to your calendar.
- A **Campaign Group section** listing accepted players and a Subs/Waitlist section for players who want to fill in if someone drops out.

---

### Stats Counting

- Each finalized campaign session counts as **1 locked game** in stats.
- An active (unfinalized) campaign counts as **1 active event**.
