# Hosted Version Maintenance Guide

This guide is for the maintainers of the **Hosted** version of TabletopTime (running on Vercel + Supabase).
It is not relevant for self-hosted users.

## Database Migrations (Supabase)

The hosted version uses PostgreSQL via a separate schema `prisma/schema.hosted.prisma`.
Vercel does **NOT** run migrations automatically. You must apply them manually.

### Workflow
When you make changes to the database structure (e.g. adding a table to both schemas):

1.  **Update Schemas**: Ensure changes are applied to `prisma/schema.hosted.prisma`.
2.  **Generate SQL**: Run the included helper script to generate the raw SQL diff.
    *   *Note: You need your Supabase Connection String (Transaction Mode, port 6543) for this.*

    ```bash
    # Windows PowerShell
    $env:DATABASE_URL="postgres://postgres.xxx:pass@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    npm run db:diff:hosted
    ```

3.  **Apply SQL**:
    *   Copy the output SQL.
    *   Go to **Supabase Dashboard > SQL Editor**.
    *   Paste and Run.

### Why manual?
We explicitly decouple the hosted database from the CI/CD pipeline to prevent accidental data loss or schema drift affecting the live production service during rapid development of the open-source core.
