# API Documentation

The Tabletop Scheduler exposes a few public endpoints to allow for external integration.

## Base URL
`/api`

## Endpoints

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

---

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
