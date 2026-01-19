---
milestone: v1.3 - Runtime Reliability
version: 1.3.0
updated: 2026-01-19
---

# Roadmap

> **Current Milestone:** v1.3 - Runtime Reliability
> **Goal:** Eliminate persistent runtime errors ("workers undefined") and ensure Server Action/Webhook reliability in Serverless environments.

## Must-Haves
- [x] Inline Webhook Delivery (No Cron Dependency)
- [x] Static Server Action Imports (Fix Manifest Errors)
- [x] Stable Runtime Configuration (Fix "workers undefined" error)
- [x] Verified Production Deployment

---

## Phases

### Phase 1: Webhook Reliability
**Status:** ✅ Complete
**Objective:** Move from unreliable cron-based webhooks to immediate inline delivery.
**Tasks:**
- [x] Create `shared/lib/webhook-sender.ts`
- [x] Integrate into `event/route.ts` and `finalize/route.ts`
- [x] Refactor retry logic

### Phase 2: Build Stability
**Status:** ✅ Complete
**Objective:** Fix "Failed to find Server Action" errors caused by dynamic imports.
**Tasks:**
- [x] Audit all `import(...)` of Server Actions
- [x] Refactor to top-level static imports
- [x] Verify build manifest generation

### Phase 3: Runtime Stability
**Status:** ✅ Complete
**Objective:** Resolve "Cannot read properties of undefined (reading 'workers')" error.
**Tasks:**
- [x] Investigate `instrumentationHook` conflict
- [x] Audit `shared/lib` for circular dependencies in Serverless
- [x] Verify `package.json` engines and dependencies
- [x] Implement conditional `output: 'standalone'`
- [x] Isolate `instrumentation.ts` with `try/catch`

---

## Progress Summary

| Phase | Status | Tasks | Complete |
|-------|--------|-------|----------|
| 1 | ✅ | 3/3 | 100% |
| 2 | ✅ | 3/3 | 100% |
| 3 | ✅ | 5/5 | 100% |
