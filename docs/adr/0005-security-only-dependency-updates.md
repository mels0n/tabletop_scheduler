# ADR 0005: Automate security updates only

- Status: Accepted
- Date: 2026-10-25

## Context

Dependabot version updates opened a pull request for every new release of every dependency, capped at five at a time. Most were routine patches, but each still needed CI, a review and a merge, and the cap meant an important update could wait behind minor ones. Majors were worse: a major release of a tool with a peer range (the coverage plugin pins `vitest` exactly, `typescript-eslint` caps TypeScript) produced pull requests that could not even install, and a TypeScript major that dependency-cruiser does not support makes the layer check cruise no modules and pass.

Security fixes are the updates that cannot wait. The rest are better done deliberately, a few related packages at a time, with the migration notes read and the full set of checks run.

## Decision

Dependabot opens pull requests for security advisories only.

- Version updates are off: every ecosystem in `.github/dependabot.yml` sets `open-pull-requests-limit: 0`. Dependabot security updates are enabled in the repository settings (Settings, Advanced Security) and run on their own limit. With version updates off, that setting is the only thing that opens dependency pull requests, so it must stay on.
- Packages that must move together (`prisma` with `@prisma/client`, `vitest` with `@vitest/*`, `next` with `eslint-config-next`) are grouped, so advisories that hit several of them arrive in one pull request. A group does not bump a partner that has no advisory, so whoever merges moves the partner to the same version by hand.
- There are no `ignore` rules. They also apply to security updates, so ignoring a major (Prisma, Node) would hide the fix for an advisory that needs one. A security pull request that needs a major fails CI, and the upgrade is then done as a planned migration.
- There is no `docker` entry. Dependabot raises no security updates for base images, and `node:22-alpine` already tracks the latest Node 22.
- Actions pinned by commit SHA get neither alerts nor security updates from GitHub. The one such pin, `aquasecurity/trivy-action` in `docker-publish.yml`, is checked and moved by hand along with the other upgrades. It stays pinned by SHA because a version tag can be moved to different code.
- Everything else is upgraded by hand, as described in `CONTRIBUTING.md` under "Updating dependencies".

CI also fails the dependency-cruiser step when TypeScript is missing or 7.x, or when its summary does not report at least one module cruised, so a compiler upgrade cannot turn the layer check into a silent pass.

## Alternatives rejected

- **Keep version updates with a lower cap or weekly grouping.** Grouping cuts the number of pull requests but not the work: a grouped bump that fails still has to be split up and investigated, and the stream of routine updates keeps going.
- **Keep version updates and ignore majors.** This was the previous setup. It still produced a pull request per patch release, and the major ignores would now also suppress security fixes.
- **Keep version updates for GitHub Actions only.** It would keep the Trivy SHA pin current automatically, but it brings back routine pull requests for a single pin that is easy to check by hand.
- **Turn Dependabot off and rely on alerts alone.** Alerts say what is vulnerable but leave the fix to be written by hand, and a fix for a transitive dependency is easy to put off.

## Consequences

- The pull request queue holds security fixes only, so each one gets attention when it arrives.
- Non-security upgrades depend on someone doing them. Nothing reminds us when a dependency falls behind, so `npm outdated` is reviewed whenever dependencies change for any reason and before a release is tagged.
- A security fix that needs a major version arrives as a failing pull request rather than being skipped.
- The self-host image picks up `node:22-alpine` patches only when it is rebuilt, which happens on each release tag and each merge to `main` that changes more than docs or blog content. Fewer dependency merges means fewer rebuilds.
