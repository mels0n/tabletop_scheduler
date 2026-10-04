# Self-host schema snapshots

Self-hosted instances run whatever release they last pulled, then upgrade by pulling a
newer image and restarting. On boot, `start.sh` runs `prisma db push` against the SQLite
file with no `--accept-data-loss`. If the new `prisma/schema.prisma` would drop, rename or
retype data that an older release wrote, the push stops and the instance does not start.

This folder holds one copy of `prisma/schema.prisma` per shipped release, so CI can prove
that every database shape a self-hoster might have upgrades cleanly to the current schema.

## Files

`<YYYY-MM-DD>-<shortsha>.prisma` is `prisma/schema.prisma` exactly as it was at that
commit (date is the commit date). The `generator` and `datasource` blocks are kept as they
were; the datasource must read `url = env("DATABASE_URL")` so the check can point it at a
temporary file.

| Snapshot | What it represents |
| --- | --- |
| `2025-12-15-b3035b1.prisma` | Initial commit, the oldest self-host schema |
| `2026-05-01-3542626.prisma` | First release whose Docker `start.sh` applied the schema with `prisma db push` |
| `2026-09-30-d0732c2.prisma` | `main` before the October 2026 backend review |

## The check

`npm run db:upgrade-check` (`scripts/selfhost-upgrade-check.mjs`, CI job `selfhost-upgrade`)
does this for every snapshot:

1. creates a fresh temporary SQLite file and pushes the snapshot schema into it,
2. inserts one Event, TimeSlot, Participant and Vote using only the columns that snapshot has,
3. runs `prisma db push --schema prisma/schema.prisma` without `--accept-data-loss`,
4. reads the rows back through the current generated client and checks their values.

A failure means the current schema would refuse to start, or lose data, on an instance
that is still on that release. Fix the schema change (see "Database change rules" in
`CONTRIBUTING.md`); never delete the snapshot to make the check pass.

## Adding a snapshot

Every release that changes `prisma/schema.prisma` adds one:

```sh
git show <release-sha>:prisma/schema.prisma > prisma/compat/<YYYY-MM-DD>-<shortsha>.prisma
npm run db:upgrade-check
```
