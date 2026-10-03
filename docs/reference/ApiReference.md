# API Reference

TabletopTime is primarily a user-facing Next.js application, but every interaction goes through an HTTP route you can call yourself. This page documents every route handler in `app/api/**/route.ts` plus the magic-link login route at `app/auth/login/route.ts`.

## Conventions

**Base URL.** Routes are served from the app origin, for example `https://tabletoptime.us/api/event`. The magic-link login route lives at `/auth/login`, outside `/api`.

**Auth kinds.** Each route below names exactly one of these.

| Auth | Meaning |
|------|---------|
| none | Public. Anyone who knows the URL can call it. |
| event admin | The caller must be the event's admin: either the `tabletop_admin_<slug>` cookie (set by the manage link) or a signed identity cookie that matches the event's stored manager. A request that fails this check gets `403`, on every route. |
| cron bearer | `Authorization: Bearer <CRON_SECRET>`. When `CRON_SECRET` is unset, every request is rejected, including loopback ones. The Docker image always generates a secret, so its internal scheduler is unaffected. |
| Telegram secret token | The `X-Telegram-Bot-Api-Secret-Token` header must match the secret registered with Telegram when the webhook was set. |
| Ko-fi token | The `verification_token` field inside the Ko-fi payload must match `KOFI_VERIFICATION_TOKEN`. |

**Authorization is checked before the body is parsed**, so an unauthorized caller learns nothing about validation.

**Identity cookies are signed.** `tabletop_user_chat_id` and `tabletop_user_discord_id` carry an HMAC signature. A bare platform ID, or a cookie with a bad signature, is ignored everywhere.

**Failures.** Every JSON failure has the same shape:

```json
{ "error": "Human readable message", "code": "validation" }
```

| Status | `code` | When |
|:------:|--------|------|
| 400 | `validation` | The body or path did not match the schema. Validation failures also include an `issues` array describing each bad field. |
| 401 | `unauthorized` | Missing or wrong cron bearer, Telegram secret token, or Ko-fi token. |
| 403 | `forbidden` | The caller is not the event admin, or is not allowed to touch that participant. |
| 404 | `not_found` | The event, slot, or participant does not exist **in this event**. IDs belonging to another event return 404, never an update. |
| 409 | `conflict` | The state changed underneath the request (for example, the event was already finalized). |
| 429 | `rate_limited` | A cooldown is in force. |
| 500 | `config` | The server is misconfigured. |
| 500 | (none) | Unexpected failure. The body is `{ "error": "Internal error" }` and the detail is in the server log. |

---

## Event Management

### Create Event
**Endpoint:** `POST /api/event`
**Auth:** none

Creates a new event with candidate time slots. The response contains the plaintext admin token once. Only its hash is stored, so it cannot be shown again.

**Request body:**
```json
{
  "title": "D&D Session 0",
  "description": "Character creation night!",
  "minPlayers": 3,
  "maxPlayers": 6,
  "timezone": "America/Chicago",
  "slots": [
    { "startTime": "2026-11-01T18:00:00.000Z", "endTime": "2026-11-01T22:00:00.000Z" }
  ],
  "fromUrl": "https://callback.example.com/webhook",
  "fromUrlId": "ext-123",
  "eventType": "ONE_SHOT",
  "minSessions": 3
}
```

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | 1 to 120 characters. |
| `description` | string | Optional, up to 2000 characters. |
| `slots` | array | 1 to 100 entries. Each needs `startTime` and `endTime` as ISO 8601 strings, with start before end. |
| `minPlayers` | integer | 1 to 100. |
| `maxPlayers` | integer or null | Null for no limit, otherwise at least `minPlayers`. |
| `timezone` | string | Must be an IANA zone known to the runtime, such as `America/Chicago`. |
| `fromUrl` | string | Optional `https` URL for [outbound webhooks](../guides/ExternalIntegrations.md). Private, loopback and link-local addresses are rejected. |
| `fromUrlId` | string | Optional caller-side ID echoed back in every webhook payload. |
| `eventType` | string | `"ONE_SHOT"` (default) or `"CAMPAIGN"`. |
| `minSessions` | integer | Required when `eventType` is `"CAMPAIGN"`: the minimum number of sessions to lock in when finalizing. |

If the caller carries a verified Telegram or Discord identity cookie, that identity is stored as the event's manager.

**Response (200):**
```json
{ "slug": "a1b2c3d4", "id": 123, "adminToken": "d9b2...uuid" }
```

If `fromUrl` is set, creating the event queues a `CREATED` webhook. It is delivered by the webhook queue, not inline with this request.

### Pre-fill Creation Form
Link users to the "Create Event" page with query parameters at `https://tabletoptime.us/new`:

- `title` (string), `description` (string)
- `minPlayers` (number, default 3), `maxPlayers` (number)
- `slots` (string): JSON array of `[{startTime: ISO, endTime: ISO}]`
- `fromUrl` (string), `fromUrlId` (string)

Example: `https://tabletoptime.us/new?title=Raid%20Night&maxPlayers=8&minPlayers=8`

### Get Event Details
**Endpoint:** `GET /api/event/[slug]`
**Auth:** none

Read-only summary of an event.

**Response (200):**
```json
{
  "title": "Campaign Session 1",
  "description": "Weekly D&D game",
  "minPlayers": 3,
  "maxPlayers": 5,
  "status": "DRAFT",
  "timeSlots": [
    { "id": 123, "startTime": "2026-01-01T18:00:00.000Z", "endTime": "2026-01-01T22:00:00.000Z" }
  ],
  "_count": { "participants": 4 }
}
```
`status` is one of `DRAFT`, `FINALIZED`, `CANCELLED`. Unknown slug returns 404.

### Submit Vote
**Endpoint:** `POST /api/event/[eventId]/vote`
**Auth:** none to vote; editing an existing participant requires proof of ownership (below)

> The path segment of this route is the numeric **event ID**, not the slug, even though the folder is named `[slug]`. Every other `/api/event/[slug]/...` route takes the slug.

Records a participant's availability. Votes are replaced as a set: slots you leave out are cleared.

**Request body:**
```json
{
  "name": "Jane Doe",
  "participantId": 123,
  "linkTelegram": true,
  "linkDiscord": true,
  "votes": [
    { "slotId": 1, "preference": "YES", "canHost": true },
    { "slotId": 2, "preference": "NO", "canHost": false }
  ]
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 1 to 60 characters. |
| `participantId` | integer | Optional. Present when editing an existing vote. |
| `votes` | array | At most 100 entries, each `slotId` unique. `preference` is `YES`, `MAYBE`, or `NO`. `canHost` is a boolean. Every slot must belong to this event, otherwise the request is rejected with 400. |
| `linkTelegram`, `linkDiscord` | boolean | Optional, default true. Set false to keep that platform identity off this participant. |
| `linkIdentity` | boolean | Optional legacy switch that sets both of the above when they are absent. |

Telegram and Discord identity is taken only from the caller's signed cookies. IDs or handles sent in the body are never used to link an identity.

**Editing.** A request that names an existing `participantId` is accepted only if it carries the signed `tabletop_participant_<slug>` cookie that was issued when that participant first voted, or a verified identity that matches the participant row. Otherwise it returns 403.

**Capacity.** On a finalized event the capacity check and the participant's status change happen in one transaction, so two simultaneous votes cannot overbook the event.

**Response (200):**
```json
{ "success": true, "participantId": 456 }
```

### Suggest Time Slot
**Endpoint:** `POST /api/event/[slug]/slot/suggest`
**Auth:** none

Lets any attendee propose a new slot when existing options do not work. Not allowed on finalized or cancelled events (400).

**Request body:**
```json
{
  "suggesterName": "Jane Doe",
  "startTime": "2026-11-05T18:00:00.000Z",
  "endTime": "2026-11-05T22:00:00.000Z"
}
```
`suggesterName` is 1 to 50 characters. `startTime` must be before `endTime`.

**Response (200):** `{ "success": true }`

---

## Host Operations

### Add Time Slot
**Endpoint:** `POST /api/event/[slug]/slot`
**Auth:** event admin

Adds a slot. Not allowed on finalized or cancelled events (400).

**Request body:** `{ "startTime": "ISO8601", "endTime": "ISO8601" }` with start before end.
**Response (200):** `{ "success": true, "slot": { "id": 1, "startTime": "...", "endTime": "..." } }`

### Modify Time Slot
**Endpoint:** `PATCH /api/event/[slug]/slot/[slotId]`
**Auth:** event admin

Changes a slot's times and clears the votes on it. Not allowed on finalized or cancelled events (400). A `slotId` from another event returns 404.

**Request body:** `{ "startTime": "ISO8601", "endTime": "ISO8601" }`
**Response (200):** `{ "success": true }`

### Delete Time Slot
**Endpoint:** `DELETE /api/event/[slug]/slot/[slotId]`
**Auth:** event admin

Deletes a slot and its votes. Same restrictions as modify.

**Response (200):** `{ "success": true }`

### Finalize Event
**Endpoint:** `POST /api/event/[slug]/finalize`
**Auth:** event admin

Locks the event on a slot (or, for campaigns, several). The slot, the host participant, and every participant updated must belong to this event. A foreign `slotId` or `houseId` returns 404 and nothing changes. The status change is conditional on the event still being a draft, so finalizing twice returns 409 and the second caller changes nothing.

**ONE_SHOT events**
- **Content-Type:** `multipart/form-data`
- **Fields:** `slotId` (required), `houseId` (optional participant ID of the host), `location` (optional text, up to 200 characters).
- **Response (200):** a redirect to the event management page.

**CAMPAIGN events**
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "slotIds": [101, 104, 107],
  "houseId": "42",
  "location": "John's House",
  "participantIds": [1, 2, 3]
}
```
- `slotIds` (required): non-empty array of slot IDs to lock in as sessions.
- `houseId` (optional): participant ID of the host as a string.
- `location` (optional): text, up to 200 characters.
- `participantIds` (optional): explicit attendee list. Without it, attendees come from the votes.
- **Response (200):**
```json
{ "success": true, "sessionCount": 3, "warning": "Fewer sessions selected than the minimum." }
```
`warning` appears (and is non-blocking) when fewer sessions are chosen than the event's `minSessions`.

### Update Location
**Endpoint:** `POST /api/event/[slug]/location`
**Auth:** event admin

Updates the location after finalization and refreshes the pinned dashboards.

**Request body:** `{ "location": "New Place" }` (0 to 200 characters)
**Response (200):** `{ "success": true, "location": "New Place" }`

### Remove Participant
**Endpoint:** `DELETE /api/event/[slug]/participant/[participantId]`
**Auth:** event admin

Removes a participant and their votes. If the event is finalized and full, removing an accepted participant promotes the next person on the waitlist. A participant ID from another event returns 404.

**Response (200):** `{ "success": true }`

### ICS Export
**Endpoint:** `GET /api/event/[slug]/ics`
**Auth:** none

Downloads an iCalendar file for a finalized event. For campaigns, `?slot=<slotId>` downloads one session and no parameter downloads all of them. Returns `text/calendar`, or a plain-text 404 if the event is missing or not finalized.

### Event Admin Magic Link
**Endpoint:** `GET /api/event/[slug]/auth?token=<token>`
**Auth:** the token itself

Exchanges the admin token (from the link shown at creation) for the admin cookie.

**Behavior:** a valid token sets `tabletop_admin_<slug>`, sets the signed identity cookies for the event's stored manager, and redirects to `/e/<slug>/manage`. A missing token redirects to `/e/<slug>`. A wrong token redirects to `/e/<slug>?error=invalid_token`. Only the real token works: the stored hash is not accepted as a password.

---

## Authentication

### Magic Link Login
**Endpoint:** `GET /auth/login?token=<token>`
**Auth:** the token itself

Redeems a login link that a bot sent by direct message. The token is short-lived (15 minutes).

**Behavior:** on success, sets the signed identity cookie for the Telegram or Discord account the link was issued to and redirects to `/profile?success=logged_in`. Failures redirect to `/profile?error=missing_token`, `invalid_token`, `expired_token`, or `server_error`.

### Start Discord OAuth
**Endpoint:** `GET /api/auth/discord?flow=<login|connect>&returnTo=<path>`
**Auth:** none

Redirects to Discord's authorization page. `flow=login` asks for identity only. `flow=connect` also asks to add the bot to a server. `returnTo` must be a same-site path (it must start with a single `/`). The request sets a short-lived `tabletop_oauth_nonce` cookie and puts the same nonce in the OAuth `state`.

**Response:** a 302 redirect to Discord, or 500 `{ "error", "code": "config" }` if `DISCORD_APP_ID` is not set.

### Discord OAuth Callback
**Endpoint:** `GET /api/auth/discord/callback?code=...&state=...`
**Auth:** none (the nonce and Discord's code are the proof)

The redirect target registered in the Discord Developer Portal. The `state` nonce must match the `tabletop_oauth_nonce` cookie, otherwise the request is rejected with 400. A `login` flow sets the signed Discord identity cookies. If the caller returns to a `/manage` page, the event is bound to this Discord account only when the caller is already verified as that event's admin. With the bot-add flow, a signed one-hour `tabletop_discord_guild_<slug>` cookie records which server the admin just added the bot to, and only that server's channels can then be listed or connected.

**Response:** a redirect to `returnTo`, with an `error` query parameter on failure.

### Clear Session
**Endpoint:** `POST /api/auth/clear-session`
**Auth:** none

Deletes the identity cookies (`tabletop_user_chat_id`, `tabletop_user_telegram_name`, `tabletop_user_discord_id`, `tabletop_user_discord_name`) and every `tabletop_admin_*` cookie on the request. Called by the error boundary when a stale cookie crashes the page.

**Response (200):** `{ "cleared": true }`

---

## Utility Endpoints

### Validate Events
**Endpoint:** `POST /api/events/validate`
**Auth:** none

Tells the client which of its remembered event slugs still exist.

**Request body:** `{ "slugs": ["a1b2c3d4", "e5f6a7b8"] }` (at most 50 slugs)

**Response (200):**
```json
{
  "validSlugs": ["a1b2c3d4"],
  "events": [
    { "slug": "a1b2c3d4", "id": 123, "status": "FINALIZED", "scheduledDate": "2026-11-01T18:00:00.000Z" }
  ]
}
```
`scheduledDate` is omitted for events that are not finalized.

### Health Check
**Endpoint:** `GET /api/health`
**Auth:** none

Returns `{ "status": "ok" }` when the process is up. With `?deep=1` it also runs `SELECT 1` against the database and reports a failure if that query does not succeed. The Docker healthcheck uses the shallow form.

---

## Integrations

### Telegram Webhook
**Endpoint:** `POST /api/telegram/webhook`
**Auth:** Telegram secret token

Entry point for Telegram Bot API updates when the bot runs in `webhook` mode. A request without the correct `X-Telegram-Bot-Api-Secret-Token` header gets 401. Once the header checks out the route always answers `200 { "ok": true }`, including when handling the update throws, so Telegram does not redeliver the same update in a loop. Repeats of the same `update_id` are processed once.

**Handled messages** (in polling mode the same handler runs, so behavior is identical):
- `/connect <slug> <code>`: connects the chat to the event. The code is shown with the command on the event's manage page and is bound to the event, so only someone who can open that page can connect a chat. A bare `/connect <slug>`, `/start <slug>`, or a pasted event link gets a reply telling the sender to use the command from the manage page, and binds nothing.
- `/start`, `/start login`: in a private chat, sends a login link.
- `/start rec_<token>`: completes a short recovery link.

### Configure Telegram Webhook
**Endpoint:** `GET /api/telegram/setup`
**Auth:** cron bearer

Registers (or re-registers) the webhook URL with Telegram, using `NEXT_PUBLIC_BASE_URL` and the bot token.

**Response (200):** `{ "success": true, "message": "Webhook configured successfully" }`. Missing configuration returns 500.

### Ko-fi Donation Webhook
**Endpoint:** `POST /api/kofi/webhook`
**Auth:** Ko-fi token

Receives donation notifications from Ko-fi. Configure it at `ko-fi.com/manage/webhooks`.

**Content-Type:** `application/x-www-form-urlencoded`, with a single field `data` containing the payment details as JSON.

**Behavior:**
- The `verification_token` is compared (in constant time) with `KOFI_VERIFICATION_TOKEN` **before** anything is logged. A wrong token returns 401. An unset `KOFI_VERIFICATION_TOKEN` rejects every request.
- Only `message_id`, `type`, and `amount` are ever logged.
- Private donations are acknowledged and not stored.
- Public donations are stored once per `kofi_transaction_id`, so Ko-fi retries are harmless.
- The raw payload is not stored. The supporter's email is never stored.
- A database failure returns 500, so Ko-fi retries the delivery.

**Stored fields:**
| Field | Source | Notes |
|-------|--------|-------|
| `fromName` | `from_name` | Supporter display name |
| `message` | `message` | Optional public message |
| `amountCents` | `amount` | Parsed to integer cents |
| `isPublic` | `is_public` | Only public donations are stored and displayed |
| `type` | `type` | Donation, Subscription, Commission, Shop Order |

**Response (200):** `{ "status": "ok" }`

---

## Scheduled Jobs

These routes are called by a scheduler, never by a browser. All three require the cron bearer.

| Route | Cadence | Scheduler |
|-------|---------|-----------|
| `GET /api/cron/cleanup` | daily | Vercel Cron at 00:00 UTC (hosted), the container's internal loop (Docker). |
| `GET /api/cron/reminders` | every 10 minutes | Supabase `pg_cron` (hosted), the container's internal loop (Docker). A GitHub Actions workflow remains as a backstop. |
| `GET /api/cron/webhooks` | every 5 minutes | Supabase `pg_cron` (hosted), the container's internal loop (Docker). |

### Cleanup Cron
**Endpoint:** `GET /api/cron/cleanup`
**Auth:** cron bearer

Deletes expired events and their related rows in batches, unpins any dashboard messages first, and removes expired login tokens. Retention, all adjustable with the `CLEANUP_RETENTION_DAYS_*` variables:

- one-shot events: 1 day after the finalized slot ends
- campaigns: 1 day after the last scheduled session ends
- drafts: 1 day after the last proposed slot ends (a draft with no slots: 1 day after creation)
- cancelled events: 1 day after cancellation

**Response (200):** `{ "success": true, "deleted": 4, "deletedLoginTokens": 2, "errors": 0, "scanned": 40 }`

### Reminders Cron
**Endpoint:** `GET /api/cron/reminders`
**Auth:** cron bearer

Runs the voting and session reminders for Telegram and Discord. A reminder is claimed in the database before it is sent, so overlapping runs send nothing twice, and a late run still sends once. If no bot is configured it returns `{ "success": true, "skipped": "no bot configured" }`.

**Response (200):** `{ "success": true, ... }` with a summary of what ran. Returns 500 if any run threw.

### Webhooks Cron
**Endpoint:** `GET /api/cron/webhooks`
**Auth:** cron bearer

Delivers queued outbound webhooks. Rows are locked atomically so two runs never send the same one. See [External Integrations](../guides/ExternalIntegrations.md) for the signature header and retry policy.

**Response (200):** `{ "processed": 3, "delivered": 2, "retrying": 1, "failed": 0 }`

---

## Outbound Webhooks

When an event is created with a `fromUrl`, TabletopTime posts JSON lifecycle updates (`CREATED`, `FINALIZED`, `CANCELLED`) to it. Payload shapes, the `X-Tabletop-Signature` header, and the retry policy are documented in [External Integrations](../guides/ExternalIntegrations.md).

Every delivery carries `X-Tabletop-Signature: sha256=<hex HMAC-SHA256 of the raw body>`. The HMAC key is the instance's webhook signing key, `hex(HMAC-SHA256(key = SESSION_SECRET, message = "webhook-signing"))`, used as its 64-character hex string. The operator shares it with integrators out of band. `CRON_SECRET` is not involved in signing.
