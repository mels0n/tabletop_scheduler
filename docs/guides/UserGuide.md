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
    - **Submit**: Saves your votes. You can edit them later if you revisit the page on the same device.
- **Best Slot**: The app automatically highlights the slot with the most "Yes" votes that meets the minimum player count.

---

## 3. Managing Your Event
**Page:** `/e/[slug]/manage` (Accessible via the footer link "Manage Event" or the link given after creation)

As the organizer, you use this page to control the event.
- **Manager Controls**:
    - **Setup Recovery**: If you haven't connected a group yet, click "Register for Magic Links" to let the bot capture your details. (See **[Magic Links](../docs/MAGIC_LINKS.md)** for details).
    - **DM Me Manager Link**: Once connected, use this to get a private login link sent to your Telegram DMs.
    - **Bot Status**: Shows if the Telegram bot is connected to your group.
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
- **Status**: Quickly see if events are Draft, Finalized, or Cancelled.
- **Cleanup**: The list automatically removes events that have been deleted from the server.
