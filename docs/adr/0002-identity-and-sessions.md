# ADR 0002: Identity and sessions

- Status: Accepted
- Date: 2026-10-02

## Context

TabletopTime's promise is that nobody needs an account. A host creates an event and shares a link. Players vote by typing a name. This is the whole reason the tool is pleasant to use compared with a group chat.

But some actions must be restricted to the person who runs the event: changing time slots, finalizing, removing a participant, connecting a chat group. And some features want to know who a person is across events and devices: "my events", recovering the manage page on a new phone, sending a direct message when a waitlist spot opens. Telegram and Discord already know who people are, and the bots can reach them.

So the question is how to tell a host from a guest, and how to recognize a returning person, without building an account system.

## Decision

**No accounts, no passwords, no email.** Identity comes from two things the user already has: a link, and (optionally) a Telegram or Discord account.

**Per-event admin tokens.** Creating an event returns a random token, shown once, which is the host's manage link. Only its SHA-256 hash is stored. Presenting the token sets a per-event `tabletop_admin_<slug>` cookie, and each request is checked by hashing the cookie and comparing it to the stored hash. The stored hash is never accepted in place of the token, and the event page never sends it to the browser.

**Signed identity cookies.** When someone logs in through Telegram or Discord, we set a cookie holding their numeric platform ID together with an HMAC-SHA256 signature made with a server-side secret (`SESSION_SECRET`). A cookie that is unsigned, or whose signature does not verify, is treated as absent. The cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.

**Platform IDs are never trusted raw.** A numeric Telegram or Discord ID is not a secret: it appears in chats, bot logs, and API responses. If the server accepted a bare ID from a cookie, request body, or typed handle as proof of identity, anyone who knew a manager's ID could become that manager. So an ID is only trusted when it arrives inside a signed cookie that this server issued after a real login, and handles typed into a form are never used to link an identity.

**Logins are proven by a bot, not by the browser.** A magic link is a short-lived, single-purpose token that a bot sends by direct message to the Telegram or Discord account it was issued for. Opening it proves the opener received that message. Discord's OAuth flow carries a nonce bound to a short-lived cookie so a login cannot be started by one person and completed by another.

**Claiming and connecting require the admin.** Connecting a chat group to an event requires a connect command with a code that is derived from the event and shown only on the manage page, so someone who merely knows an event's slug cannot redirect its notifications. Binding a Discord server is limited to the server the admin just added the bot to.

**Participants.** A voter is just a name on a row. To stop one guest from editing another's votes, the first vote sets a signed `tabletop_participant_<slug>` cookie, and an edit must present it (or a verified identity that matches the row).

## Alternatives considered

- **Accounts with email and password, or "sign in with Google".** The standard answer, and it would make identity simple. It lost because it adds a signup wall to something people use once or twice a month, makes me the custodian of credentials and email addresses, and contradicts the privacy promise. It would also be a poor fit for a self-hosted tool.
- **Trust the Telegram or Discord ID directly.** Simpler, and it is how the first version worked. It lost because the ID is public information, so it is an identifier, not a credential.
- **Server-side sessions in the database.** Revocable and compact, but every request would need a lookup and the self-hosted SQLite would take the write load of session churn. Signed cookies keep the check stateless. The trade-off is that a stolen cookie works until it expires, which we accept for a low-stakes app and mitigate with `httpOnly`, `SameSite`, and a clear-session route.
- **JWTs.** More machinery than the problem needs. We sign one small value with one key, so a plain HMAC is easier to reason about and has fewer ways to be misconfigured.
- **Storing the admin token in plaintext, or using the hash as the credential.** Either lets a database read or a leaked page payload become full control of an event. Hashing the token and requiring the original on every check keeps a read-only leak from being a takeover.
- **Email magic links.** Would work, but it requires collecting an address we otherwise have no reason to hold, and it requires running an email pipeline. The bots are already the channel people use.

## Consequences

- Changing `SESSION_SECRET` signs everyone out of Telegram and Discord identity. Admin cookies are unaffected because they are verified against the stored hash, not the secret. Treat the secret like any other credential.
- Someone who loses their manage link and has not linked Telegram or Discord has no recovery path. This is the cost of having no accounts. The manage page encourages linking an identity for exactly this reason.
- A signed cookie proves "this browser logged in as this platform user", not "this person is who they say". That is the intended strength of the model, and it is enough to gate event administration and cross-device history.
- Because identity is optional, features that depend on it (direct messages, cross-device history) quietly do nothing for people who never linked an account.
