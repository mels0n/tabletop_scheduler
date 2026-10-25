# ADR 0005: Automate security updates only

- Status: Accepted
- Date: 2026-10-25

## Context

Dependabot version updates opened a pull request for every new release of every dependency, capped at five at a time. Most were routine patches, but each still needed CI, a review and a merge, and the cap meant an important update could wait behind minor ones. Majors were worse: a major release of a tool with a peer range (the coverage plugin pins `vitest` exactly, `typescript-eslint` caps TypeScript) produced pull requests that could not even install, and a TypeScript major that dependency-cruiser does not support makes the layer check cruise no modules and pass.

Security fixes are the updates that cannot wait. The rest are better done deliberately, a few related packages at a time, with the migration notes read and the full set of checks run.

## Decision

Dependabot opens pull requests for security advisories only.

- Version updates are off: every ecosystem in `.github/dependabot.yml` sets `open-pull-requests-limit: 0`. Dependabot security updates are enabled in the repository settings and run on their own limit.
- Packages that must move together (`prisma` with `@prisma/client`, `vitest` with `@vitest/*`, `next` with `eslint-config-next`) are grouped for security updates.
- There are no `ignore` rules. They also apply to security updates, so ignoring a major (Prisma, Node) would hide the fix for an advisory that needs one. A security pull request that needs a major fails CI, and the upgrade is then done as a planned migration.
- There is no `docker` entry. Dependabot raises no security updates for base images, and `node:22-alpine` already tracks the latest Node 22.
- Other upgrades are done by hand: check `npm outdated` and `npm audit`, upgrade related packages together, and run every check listed in `AGENTS.md`.

CI also fails the dependency-cruiser step when TypeScript is missing or 7.x, or when a run cruised no modules, so a compiler upgrade can never turn the layer check into a silent pass.

## Alternatives rejected

- **Keep version updates with a lower cap or weekly grouping.** Grouping cuts the number of pull requests but not the work: a grouped bump that fails still has to be split up and investigated, and the stream of routine updates keeps going.
- **Keep version updates and ignore majors.** This was the previous setup. It still produced a pull request per patch release, and the major ignores would now also suppress security fixes.
- **Turn Dependabot off and rely on alerts alone.** Alerts say what is vulnerable but leave the fix to be written by hand, and a fix for a transitive dependency is easy to put off.

## Consequences

- The pull request queue holds security fixes only, so each one gets attention when it arrives.
- Non-security upgrades depend on someone doing them. Nothing reminds us when a dependency falls behind, so outdated packages are reviewed periodically and upgraded in planned batches.
- A security fix that needs a major version arrives as a failing pull request rather than being skipped.
