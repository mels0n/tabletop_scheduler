---
phase: 1
plan: 3
wave: 1
---

# Plan 1.3: Schema Isolation & Build Hygiene

## Objective
Ensure strict build-time separation between Hosted and Self-Hosted modes.

## Context
- package.json
- prisma/schema.prisma

## Tasks

<task type="auto">
  <name>Add Self-Hosted Build Script</name>
  <files>package.json</files>
  <action>
    Add `"build:selfhosted"` to scripts.
  </action>
  <verify>grep "build:selfhosted" package.json</verify>
  <done>Script exists</done>
</task>

## Success Criteria
- [ ] `npm run build:selfhosted` works.
