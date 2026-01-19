# External Integrations Guide

Tabletop Scheduler (Hosted & Self-Hosted) supports bi-directional integration with external communities, websites, and bots. This allows you to manage events seamlessly from your own platform while leveraging our powerful scheduling tools.

## Feature Overview

1.  **Event Pre-filling**: Create "One-Click" event creation links from your community Discord, Wiki, or Website.
2.  **Identity Hand-off**: Send users to the voting page with their name pre-filled, removing friction.
3.  **Webhook Callbacks**: Receive real-time JSON notifications when an event is created or finalized.

---

## 1. Creating Events via Link

 You can construct a standard `HTTPS` link to the `/new` page with query parameters. This is perfect for a "Schedule Game" button in your own app.

**Base URL**: `https://tabletoptime.us/new` (or your self-hosted domain)

### Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `title` | string | The name of the event. |
| `description` | string | Optional description text. |
| `minPlayers` | number | Minimum players required (default: 3). |
| `maxPlayers` | number | Maximum players allowed. |
| `fromUrl` | url | **Required for Webhooks**. The generic HTTP endpoint we will POST JSON updates to (not Discord-specific). |
| `fromUrlId` | string | Your system's unique ID for this context (e.g., a Database Row ID, Discord Message ID, or UUID). |

### Example Link
```text
https://tabletoptime.us/new?title=Raid+Night&minPlayers=8&fromUrl=https://api.myguild.com/events/callback&fromUrlId=raid-101
```

---

## 2. Webhook Callbacks

If you provide `fromUrl` during creation, Tabletop Scheduler will send `POST` requests to that URL with a JSON payload.

> **Reliability**: We attempt delivery every 5 minutes for up to **1 hour**. If your server is down for more than an hour, the webhook will fail permanently.

### Response Expectations

Your server must return a **HTTP 2xx** status code (e.g., 200 OK) to acknowledge receipt. The response body is ignored. Any non-2xx status (or timeout) triggers the retry policy.

### Event Created (`CREATED`)
Sent immediately after the user effectively creates the event.

**Payload:**
```json
{
  "type": "CREATED",
  "eventId": 123,
  "fromUrlId": "raid-101",
  "slug": "8f8f8f8f",
  "link": "https://tabletoptime.us/e/8f8f8f8f",
  "title": "Raid Night",
  "timestamp": "2023-11-25T14:00:00.000Z"
}
```

### Event Finalized (`FINALIZED`)
Sent when the host locks in a time slot and location.

**Payload:**
```json
{
  "type": "FINALIZED",
  "eventId": 123,
  "fromUrlId": "raid-101",
  "slug": "8f8f8f8f",
  "link": "https://tabletoptime.us/e/8f8f8f8f",
  "title": "Raid Night",
  "finalizedSlot": {
    "id": 456,
    "startTime": "2023-12-01T18:00:00.000Z", // ISO 8601
    "endTime": "2023-12-01T22:00:00.000Z"
  },
  "attendees": ["Leeroy", "Jaina"],
  "waitlist": ["Thrall"],
  "location": "Blackrock Depths",
  "timestamp": "2023-11-28T10:00:00.000Z"
}
```

### Event Cancelled (`CANCELLED`)
Sent if the organizer cancels the event.

**Payload:**
```json
{
  "type": "CANCELLED",
  "eventId": 123,
  "fromUrlId": "raid-101",
  "slug": "8f8f8f8f",
  "title": "Raid Night",
  "timestamp": "2023-11-29T09:00:00.000Z"
}
```

---

## 3. Pre-filling Voter Identity

To make it easier for your community members to vote, you can append `?userID=...` to the shared event link.

**Logic**: 
- If the user has visited before, their local browser storage takes precedence.
- If they are **new**, the `userID` value is used to pre-fill the "Your Name" field.

**Usage**:
Generate links dynamically in your system:
`https://tabletoptime.us/e/[slug]?userID=ProGamer123`

---

## Security Notes

1.  **Validation**: We do not currently sign webhook payloads with a shared secret. It is recommended to verify the `fromUrlId` against your own database to ensure the update relates to a known request.
2.  **HTTPS**: We strongly recommend using `https` URLs for `fromUrl` to ensure payload privacy.
