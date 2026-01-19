---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.2.0
lastUpdated: 2026-01-19
---

# Specification: TypeScript Strictness

## 1. Goal
Achieve full TypeScript strictness (`"strict": true`) across the entire codebase to eliminate type-safety blind spots and reduce runtime errors.

## 2. Success Criteria
- [ ] `tsconfig.json` has `"strict": true` enabled.
- [ ] `npm run build` passes with zero type errors.
- [ ] No usage of `any` (explicit or implicit) in new code.
- [ ] `eslint` configured to ban `any`.

## 3. Core Requirements
- **Strict Null Checks**: Mandate handling of null/undefined.
- **No Implicit Any**: Variables must have defined types.
- **Strict Property Initialization**: Class properties must be initialized.
