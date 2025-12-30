# API Reference

TabletopTime is primarily a user-facing Next.js application, but it exposes several API endpoints for client-side interactions, webhooks, and cron jobs.

## Base URL
All API routes are prefixed with `/api`.
Example: `https://your-domain.com/api/event`

---

## Event Management

### Create Event
**Endpoint:** `POST /api/event`
**Description:** Creates a new event with candidate time slots.

**Request Body:**
```json
{
  "title": "D&D Session 0",
  "description": "Character creation night!",
  "minPlayers": 3,
  "slots": [
    { "startTime": "2023-11-01T18:00:00.000Z", "endTime": "2023-11-01T22:00:00.000Z" }
  ]
}
```

### Pre-fill Creation Form
You can link users to the "Create Event" page with pre-filled values using query parameters.

**UID:** `https://your-domain.com/new`

**Parameters:**
- `title` (string): Pre-fills title
- `description` (string): Pre-fills description
- `minPlayers` (number): Pre-fills minimum players (default 3)
- `maxPlayers` (number): Pre-fills maximum players
- `slots` (string): JSON stringified array of objects `[{startTime: ISO, endTime: ISO}]`

**Example:**
`https://tabletopscheduler.com/new?title=Raid%20Night&maxPlayers=8&minPlayers=8`

### Get Event Details
Retrieve read-only details about a specific event.

**Endpoint:** `GET /event/:slug`

**Response:**
```json
{
  "title": "Campaign Session 1",
  "description": "Weekly D&D game",
  "minPlayers": 3,
  "maxPlayers": 5,
  "status": "DRAFT", // DRAFT, FINALIZED, CANCELLED
  "timeSlots": [
    {
      "id": 123,
      "startTime": "2024-01-01T18:00:00.000Z",
      "endTime": "2024-01-01T22:00:00.000Z"
    }
  ],
  "_count": {
    "participants": 4
  }
}
```

### Create Event
**Description:** Creates a new event with candidate time slots.

**Request Body:**
```json
{
  "title": "D&D Session 0",
  "description": "Character creation night!",
  "minPlayers": 3,
  "slots": [
    { "startTime": "2023-11-01T18:00:00.000Z", "endTime": "2023-11-01T22:00:00.000Z" }
  ]
}
```

**Response (200 OK):**
```json
{
  "slug": "a1b2c3d4",
  "id": 1,
  "adminToken": "uuid-token-string"
}
```

### Submit Vote
**Endpoint:** `POST /api/event/[eventId]/vote`
**Description:** Records a participant's availability for specific slots.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "telegramId": "@jane", // Optional
  "participantId": 123, // Optional, if updating existing vote
  "votes": [
    { "slotId": 1, "preference": "YES", "canHost": true },
    { "slotId": 2, "preference": "NO" }
  ]
}
```

**Response (200 OK):**
```json
{ "success": true, "participantId": 456 }
```

## Host Operations

### Magic Link Auth
**Endpoint:** `GET /api/event/[slug]/auth`
**Description:** detailed logic for processing admin tokens from Telegram.
**Query Params:** `?token=[uuid]` from the database.
**Response:** Redirects to `/manage` on success or `?error` on failure.

### Finalize Event
**Endpoint:** `POST /api/event/[slug]/finalize`
**Description:** Selects a final time slot and locks the event.
**Headers:** `Content-Type: multipart/form-data`
**Body:**
- `slotId`: ID of the TimeSlot.
- `houseId`: (Optional) Participant ID of the host.
- `location`: (Optional) String text for location.

### Update Location
**Endpoint:** `POST /api/event/[slug]/location`
**Description:** Updates location string *after* finalization.
**Body (JSON):** `{ "location": "New Place" }`

### ICS Export
**Endpoint:** `GET /api/event/[slug]/ics`
**Description:** Downloads an iCalendar file for the finalized event.

---

## Integrations

### Telegram Webhook
**Endpoint:** `POST /api/telegram/webhook`
**Description:** Entry point for Telegram Bot API updates. Configured via `setWebhook` on Telegram's side.

**Supported Triggers:**
- **Text Match**: `/e/[slug]` or `https://.../e/[slug]` (Connects group to event)
- **Command**: `/connect [slug]`
- **Command**: `/start` (Registers user for DMs)

**Response:** Always returns `200 OK` `{"ok": true}` to acknowledge receipt to Telegram, even if processing fails/is ignored.

---

## Maintenance

### Cleanup Cron
**Endpoint:** `GET /api/cron/cleanup`
**Description:** Removes old/expired events to keep the database size manageable. Designed to be called by an external scheduler (e.g., GitHub Actions, cron-job.org, or system cron).

**Authentication:** 
- **Internal Only:** This endpoint is restricted to localhost (127.0.0.1) access and is triggered automatically by the internal Docker scheduler. Public access is blocked.

**Behavior:**
- Runs automatically daily at 03:00 UTC (via internal cron).
- Deletes events based on configured retention days (Default: 1 day).
- Unpins Telegram status messages before deletion.

---

## Utility Endpoints

### Validate Event
**Endpoint:** `POST /api/events/validate`
**Description:** Checks if a specific event slug exists and is valid. Used for client-side pre-fetching or validation.
**Body:** `{ "slug": "abc-123" }`
**Response:** `{ "valid": true, "event": { ... } }` or `{ "valid": false }`

### Magic Link Login
**Endpoint:** `GET /auth/login`
**Description:** Handles Magic Link authentication token. Sets a session cookie and redirects.
**Query Params:** `?token=[uuid]`
**Behavior:** 
- If valid: Redirects to `/` (Homepage) or stored return URL.
- If invalid: Redirects to `/login?error=InvalidToken`.

### Static Assets
**Endpoint:** `GET /ads.txt`
**Description:** Serves the Google AdSense verification file based on `NEXT_PUBLIC_GOOGLE_ADSENSE_ID`.

---

> [!NOTE]
> **API Routing Note**: 
> The `/api/event/[slug]/...` routes serve multiple purposes. 
> - `/finalize` expects the **Slug** (string).
> - `/vote` expects the **Event ID** (integer) despite the URL structure. 
> Ensure your client sends the correct identifier for the specific action.
