---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Backup Scripts & Docs

## Objective
Create the tools and knowledge base required for operations.

## Tasks

<task type="auto">
  <name>Create Backup Script</name>
  <files>scripts/db-backup.sh</files>
  <action>
    Create a bash script that uses `pg_dump`.
    Ensure it handles `DATABASE_URL` from .env.
    Make it executable.
  </action>
  <verify>Test-Path scripts/db-backup.sh</verify>
  <done>Script created</done>
</task>

<task type="auto">
  <name>Create Restore Script</name>
  <files>scripts/db-restore.sh</files>
  <action>
    Create a bash script that uses `psql` or `pg_restore`.
    Add safety prompts ("Are you sure?").
  </action>
  <verify>Test-Path scripts/db-restore.sh</verify>
  <done>Script created</done>
</task>

<task type="auto">
  <name>Create Recovery Runbook</name>
  <files>docs/recovery.md</files>
  <action>
    Document how to use the scripts.
    Explain the difference between Hosted (these scripts) and Self-Hosted (SQLite file copy).
  </action>
  <verify>Test-Path docs/recovery.md</verify>
  <done>Docs created</done>
</task>
