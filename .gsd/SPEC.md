---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.1.0
lastUpdated: 2026-01-19
---

# Specification: Hosted Database Resilience

## 1. Goal
Implement a robust backup and recovery system for the Hosted (Postgres) environment to prevent data loss and ensure business continuity.

## 2. Success Criteria
- [ ] Automated daily backups for Hosted Postgres database (Verified via platform or script).
- [ ] Verified recovery procedure (restore from backup).
- [ ] Documentation for performing a restore operation.

## 3. Core Requirements
- **Backup**: Mechanism to snapshot production data.
- **Recovery**: Script or procedure to restore a specific snapshot.
- **Scope**: Hosted mode only (Supabase/Postgres). Self-hosted (SQLite) is out of scope.
