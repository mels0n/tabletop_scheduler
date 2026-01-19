# Milestone: v1.0 - Technical Debt Cleanup

## Completed: 2026-01-19

## Deliverables
- ✅ Refactor `app/actions.ts` (Split into `features/*/server/actions.ts`)
- ✅ Database Schema Isolation (`build:selfhosted` vs `build:hosted`)
- ✅ Testing Infrastructure (Vitest, Global Mocks, Safety Nets)

## Phases Completed
1. Phase 1: Technical Debt Cleanup — 2026-01-19

## Metrics
- **Phases:** 3/3 Plan Items Executed (1.1, 1.2, 1.3)
- **Tests Created:** 9 (4 Auth Safety, 5 Event Mgmt)
- **Duration:** 1 Day

## Lessons Learned
- **Testing First:** Creating `tests/auth-safety.test.ts` BEFORE refactoring `app/actions.ts` gave us confidence to move fast.
- **Strict Separation:** Adding `build:selfhosted` resolved ambiguity about which schema was being used.
- **Deferrals:** We deferred generic TypeScript strictness to focus on tangible architectural cleanup.
