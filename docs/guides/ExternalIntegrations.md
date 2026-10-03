# External Integrations Guide

Tabletop Scheduler (Hosted & Self-Hosted) supports bi-directional integration with external communities, websites, and bots. This allows you to manage events seamlessly from your own platform while leveraging our powerful scheduling tools.

## Feature Overview

1.  **Event Pre-filling**: Create "One-Click" event creation links from your community Discord, Wiki, or Website.
2.  **Identity Hand-off**: Send users to the voting page with their name pre-filled, removing friction.
3.  **Webhook Callbacks**: Receive JSON notifications when an event is created, finalized, or cancelled.

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
| `fromUrl` | url | **Required for Webhooks**. The `https` endpoint we will POST JSON updates to (not Discord-specific). Private, loopback and link-local addresses are rejected. |
| `fromUrlId` | string | Your system's unique ID for this context (e.g., a Database Row ID, Discord Message ID, or UUID). |

### Example Link
```text
https://tabletoptime.us/new?title=Raid+Night&minPlayers=8&fromUrl=https://api.myguild.com/events/callback&fromUrlId=raid-101
```

---

## 2. Webhook Callbacks

If you provide `fromUrl` during creation, Tabletop Scheduler will send `POST` requests to that URL with a JSON payload.

### Delivery

Webhooks are queued when the event happens and delivered by a background job that runs every 5 minutes. A delivery usually arrives within a few minutes, not inside the request that caused it.

**Signature.** Every request carries this header:

```text
X-Tabletop-Signature: sha256=<hex>
```

`<hex>` is the HMAC-SHA256 of the **raw request body**, keyed with the signing key for that destination. Every delivery is signed; there is no unsigned mode.

Each destination's key is derived from its origin (scheme, host and port of the `fromUrl`, for example `https://hooks.example.com`) and the instance's `SESSION_SECRET`, so there is no separate variable to set:

```text
signing_key = hex( HMAC-SHA256( key = SESSION_SECRET, message = "webhook-signing" + "\0" + origin ) )
```

`"\0"` is a single NUL byte. Every `fromUrl` on the same origin shares one key, and a different origin gets a different key, so one integrator's key cannot sign deliveries another destination would accept.

The 64 lowercase hex characters of `signing_key` are themselves the HMAC key for the body signature (use the string as is, do not hex-decode it). `CRON_SECRET` is not involved, so holding a signing key does not let anyone call the instance's cron routes, and the key reveals nothing about `SESSION_SECRET`. An operator prints the key for one destination origin with:

```sh
ORIGIN=https://hooks.example.com node -e "console.log(require('crypto').createHmac('sha256', process.env.SESSION_SECRET).update('webhook-signing\0' + process.env.ORIGIN).digest('hex'))"
```

The operator shares each destination's value with that integrator out of band (it is never shown in the app). Changing `SESSION_SECRET` changes the key, so integrators need the new value after a rotation. Verify the header before trusting a payload:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function isValid(rawBody, header, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

On tabletoptime.us, ask the operator for the signing key. Until you have it, rely on the checks under Security Notes.

**Retries.** A failed delivery is retried with a growing delay. After attempt *n* fails, the next attempt waits *n* squared times 5 minutes (so 5, 20, 45, 80 minutes, and so on). After 12 failed attempts, roughly 42 hours in total, the webhook is marked `FAILED` and is not tried again. The job runs every 5 minutes, so actual times are rounded up to the next run.

**Redirects and addresses.** We do not follow redirects, and we only connect to public addresses. A `fromUrl` that resolves to a private or loopback address is rejected. Each delivery resolves the host once, checks every address, and connects only to the addresses it checked, so a DNS record that changes mid-delivery cannot redirect the request.

### Response Expectations

Your server must return a **HTTP 2xx** status code (e.g., 200 OK) to acknowledge receipt. The response body is ignored. Any non-2xx status (or timeout) counts as a failed attempt and follows the retry schedule above. Deliveries can repeat, so treat `eventId` plus `type` as an idempotency key.

### Event Created (`CREATED`)
Queued when the event is created.

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
Queued when the host locks in a time slot and location.

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
    "startTime": "2023-12-01T18:00:00.000Z",
    "endTime": "2023-12-01T22:00:00.000Z"
  },
  "attendees": ["Leeroy", "Jaina"],
  "waitlist": ["Thrall"],
  "location": "Blackrock Depths",
  "timestamp": "2023-11-28T10:00:00.000Z"
}
```

### Event Cancelled (`CANCELLED`)
Queued if the organizer cancels the event. It is delivered like the other types, with the same signature and retry policy.

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

1.  **Signatures**: Every delivery is signed with `X-Tabletop-Signature`, keyed with the signing key derived from `SESSION_SECRET` (see Delivery above). Verify it whenever you hold the key. On any instance, also verify the `fromUrlId` against your own database to ensure the update relates to a known request.
2.  **HTTPS**: `fromUrl` must be an `https` URL. Plain `http` URLs are rejected when the event is created.
