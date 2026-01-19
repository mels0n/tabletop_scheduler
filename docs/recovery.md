# Disaster Recovery Runbook

> **Scope**: Hosted Postgres Database (Supabase)
> **Strategy**: Encrypted Local Backups (Manual-Triggered)

## 1. Setup

Ensure your local `.env` has the following:
```env
# Connection String (Supabase Connection Pooler or Direct)
DATABASE_URL="postgres://..."

# Encryption Key (MAKE THIS LONG AND SECURE!)
BACKUP_ENCRYPTION_KEY="your-super-secret-passphrase-here"
```

> ⚠️ **IMPORTANT**: If you lose `BACKUP_ENCRYPTION_KEY`, your backups are useless. Store it in a password manager.

## 2. Process: The "Rollback Plan"
**Before pushing any code change that impacts the database (Migrations, Schema Changes):**

1.  Run the backup script:
    ```bash
    npm run db:backup
    ```
2.  Verify a green `✅ Backup Process Completed` message.
3.  Check the `backups/` folder. You will see a file like `backup-2026-01-19T12-00-00.enc`.
4.  **Optional but Recommended**: Move this file to secure cloud storage (Google Drive, Dropbox).

## 3. Disaster Recovery (Restore)
**If a migration fails or data is corrupted:**

1.  Locate the backup file you want to restore.
2.  Run the restore script:
    ```bash
    npm run db:restore backups/backup-2026-01-19T12-00-00.enc
    ```
3.  Type `RESTORE` when prompted.
4.  Wait for completion.

## 4. Security Notes
- Backups are encrypted with `AES-256-CBC`.
- They are safe to store at rest.
- **NEVER** push backup files to Git (they are gitignored by default).
