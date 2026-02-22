# API Reference

TabletopTime is primarily a user-facing Next.js application, but it exposes several API endpoints for client-side interactions, webhooks, and cron jobs.

## Base URL
All API routes are prefixed with `/api`.
Example: `https://tabletoptime.us/api/event`

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
  ],
  "fromUrl": "https://callback.com/webhook",
  "fromUrlId": "ext-123"
}
```

### Pre-fill Creation Form
You can link users to the "Create Event" page with pre-filled values using query parameters.

**UID:** `https://tabletoptime.us/new`

**Parameters:**
- `title` (string): Pre-fills title
- `description` (string): Pre-fills description
- `minPlayers` (number): Pre-fills minimum players (default 3)
- `maxPlayers` (number): Pre-fills maximum players
- `slots` (string): JSON stringified array of objects `[{startTime: ISO, endTime: ISO}]`
- `fromUrl` (string): Webhook URL for callback events
- `fromUrlId` (string): External ID to track this event context

**Example:**
`https://tabletoptime.us/new?title=Raid%20Night&maxPlayers=8&minPlayers=8`

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

**Response:**
- **Success:** Redirects to the event management dashboard.
- **Error:** Returns JSON with error details.

### Update Location
**Endpoint:** `POST /api/event/[slug]/location`
**Description:** Updates location string *after* finalization.
**Body (JSON):** `{ "location": "New Place" }`
**Response:** `{ "success": true, "location": "New Place" }`

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

---

> [!NOTE]
> **API Routing Note**: 
> The `/api/event/[slug]/...` routes serve multiple purposes. 
> - `/finalize` expects the **Slug** (string).
> - `/vote` expects the **Event ID** (integer) despite the URL structure. 
> Ensure your client sends the correct identifier for the specific action.

## External Integrations

### Integration Callbacks (Webhooks)
When creating an event, you can provide a `fromUrl` parameter. The system will post JSON updates back to this URL when significant lifecycle events occur.

**Retry Policy:** 
- Webhooks are retried every 5 minutes.
- **Timeout:** 1 Hour (~12 attempts). After 1 hour of failures, the webhook is marked as FAILED and no further attempts are made.

**Response Expectations:**
- Your server must return a **HTTP 2xx** status code (e.g., 200 OK) to acknowledge receipt.
- The response body is ignored.
- Any non-2xx status (or timeout) triggers the retry policy.

#### 1. Event Created
Sent immediately after `POST /api/event` success if `fromUrl` is present.

**Payload:**
```json
{
  "type": "CREATED",
  "eventId": 123,
  "fromUrlId": "external-id-123", // Mirrored from input
  "slug": "8f8f8f8f",
  "link": "https://tabletoptime.us/e/8f8f8f8f",
  "title": "My Event",
  "timestamp": "2023-11-25T14:00:00.000Z"
}
```

#### 2. Event Finalized
Sent when the event is successfully finalized.

**Payload:**
```json
{
  "type": "FINALIZED",
  "eventId": 123,
  "fromUrlId": "external-id-123",
  "slug": "8f8f8f8f",
  "link": "https://tabletoptime.us/e/8f8f8f8f",
  "title": "My Event",
  "finalizedSlot": {
    "id": 456,
    "startTime": "2023-12-01T18:00:00.000Z",
    "endTime": "2023-12-01T22:00:00.000Z"
  },
  "attendees": ["Alice", "Bob"],
  "waitlist": ["Charlie"],
  "location": "Game Store A",
  "timestamp": "2023-11-28T10:00:00.000Z"
}
```

#### 3. Event Cancelled
Sent if the organizer cancels the event.

**Payload:**
```json
{
  "type": "CANCELLED",
  "eventId": 123,
  "fromUrlId": "external-id-123",
  "slug": "8f8f8f8f",
  "timestamp": "2023-11-29T09:00:00.000Z"
}
```

### Pre-fill & Deep Linking

#### Voting Page (`/e/[slug]`)
- **`userID`**: Pre-fills the "Your Name" input field for the voter.  
  *Example:* `https://tabletoptime.us/e/abc-123?userID=PlayerOne`
