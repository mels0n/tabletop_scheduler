# ADR 0003: 128-bit base62 identifiers

- Status: Accepted
- Date: 2026-10-11

## Context

Every way into an event is a random string: the public slug in the event link, the admin token, login and recovery links, and the code in the Telegram `/connect` command. These were minted at different times with different generators. The oldest slugs are 8 hex characters (32 bits), later slugs 14 base62 characters (80 bits), admin and login tokens UUIDv4 (122 bits), the Telegram recovery token 8 hex characters, and the connect code the first 8 hex characters of an HMAC.

Nothing here has an account behind it, so these strings are the only thing standing between a stranger and an event. They are attacked online, one request at a time, but a uniform and generous floor removes any argument about whether a given one is long enough.

ADR 0002 already commits the project to never invalidating a link or token that someone holds.

## Decision

Every newly minted slug, admin token, login token, recovery token and connect code carries 128 random bits (the connect code: the first 128 bits of its HMAC), encoded as exactly 22 base62 characters (`0-9A-Za-z`, case-sensitive). One helper, `newToken()` / `toBase62()` in `shared/lib/token.ts`, produces all of them.

Older forms stay valid indefinitely:

- Slugs are looked up by exact match, so 8- and 14-character slugs keep working.
- Tokens are compared by their SHA-256 hash, which does not depend on format, so UUID and 8-hex tokens keep working. Legacy plaintext admin tokens are still upgraded to their hash on first use.
- An 8-hex connect code is still accepted, case-insensitively, while the event's `telegramConnectNonce` predates this change. Every nonce written from now on starts with `v2_`, and an event whose nonce has that prefix accepts only the 22-character code. Every successful `/connect` writes a new nonce, so each event moves to the long code the first time it is connected after this change. Any code that writes this column must use `newConnectNonce()`.

`tests/integration/legacy-formats.test.ts` drives each old form through the real handlers on SQLite.

## Alternatives rejected

- **Base64url.** It is denser per character, but 128 bits still needs 22 characters, so it saves nothing. Its `-` and `_` break the alphanumeric slug parsers used for Telegram commands and pasted links, and chat apps tend to trim or reformat them.
- **Hex.** It survives everything but takes 32 characters for 128 bits, which makes the links and the connect command noticeably longer.
- **256 bits.** 43 characters per link, with no practical gain against online guessing.
- **Rotating or expiring old slugs, tokens and codes.** This breaks links people already hold, which ADR 0002 rules out.
- **A sunset date for old connect codes.** This is the same cutoff in a different form. The residual exposure (32 bits, guessable only by sending the bot billions of messages) ends on its own when the event next connects.

## Consequences

- Links and the connect command are longer (22-character slugs; `/connect <22> <22>`). The manage page wraps the command instead of truncating it.
- Connect codes are case-sensitive, so they must be pasted, not retyped.
- Identifier formats now vary with an event's age, so nothing may assume a fixed length or format. Validators accept up to 64 characters for slugs and 128 for tokens.
- Rolling back past this change makes the old code reject 22-character connect codes until the command is copied again. Slugs and tokens are unaffected.
