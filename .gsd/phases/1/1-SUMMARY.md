# Summary: Plan 1.1

## What was done
- Standardized `log.info` in `app/auth/login/route.ts` and `app/api/event/[slug]/auth/route.ts` to output `{ scope, identifier }`.
- Updated `ManagerRecovery.tsx` and `DiscordLoginSender.tsx` placeholder text to clarify `@` is optional.
- Explicitly stripped `@` from inputs in Discord server actions to match DB storage (`username = username.replace('@', '').trim();`).
- Explicitly prefixed Telegram inputs with `@` during recovery logging if missing.

## Verification
- Code successfully builds via `npm run build`.
- `grep` results confirmed `Magic Link login successful` string exactly matches across auth routes.
