#!/bin/sh
set -e

# ==============================================================================
# Script Name: start.sh
# Description: Entrypoint script for the Docker container.
# Responsibilities:
# 1. Environment Setup: Ensures DATABASE_URL is set (defaults to SQLite file).
# 2. Secrets: Generates and persists SESSION_SECRET and CRON_SECRET when not provided.
# 3. Database Migrations: Runs Prisma migrations on startup.
# 4. Cron Simulation: Starts background loops (authorized with CRON_SECRET, logging to stdout) for:
#    - Daily Cleanup (removes old data).
#    - Reminder Checks (runs every 10 minutes to notify users).
# 5. App Execution: Starts the Next.js server.
#
# Reason for Internal Cron:
# In self-hosted Docker environments, we often lack an external scheduler like Vercel Cron.
# These `while true` loops act as a poor man's scheduler to ensure reminders are sent.
# ==============================================================================

echo "🚀 Starting Tabletop Scheduler..."
echo "📂 Current user: $(whoami)"

# Config: Database Default
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️ DATABASE_URL not set. Defaulting to file:/app/data/scheduler.db"
    export DATABASE_URL="file:/app/data/scheduler.db"
else
    echo "✅ DATABASE_URL is set."
fi

echo "📂 Checking /app/data permissions..."
ls -ld /app/data

# Config: Secrets
# SESSION_SECRET signs identity cookies; CRON_SECRET authorizes the internal cron calls.
# If either is not provided, generate 32 random bytes once and persist it in the data
# volume so it survives restarts (rotating SESSION_SECRET would sign everyone out).
ensure_secret() {
    name="$1"
    file="$2"
    eval "current=\${$name:-}"
    if [ -n "$current" ]; then
        echo "✅ $name is set."
        return
    fi
    if [ ! -s "$file" ]; then
        echo "🔑 $name not set. Generating one at $file"
        (umask 077 && node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$file")
    else
        echo "🔑 $name not set. Reusing $file"
    fi
    export "$name=$(cat "$file")"
}
ensure_secret SESSION_SECRET /app/data/.session-secret
ensure_secret CRON_SECRET /app/data/.cron-secret

# Action: Migrations
echo "⚙️ Running database migrations..."
if printf '%s\n' "$DATABASE_URL" | grep -qE '^(file:|sqlite:)'; then
    echo "⚙️ SQLite detected; applying schema with prisma db push..."
    npx prisma db push --schema=./prisma/schema.prisma
else
    echo "⚙️ Non-SQLite database detected; running prisma migrate deploy..."
    npx prisma migrate deploy
fi

# Action: Cron Loop (Cleanup)
echo "⏰ Setting up internal cleanup loop..."
# Strategy: Run once after 5 minutes to clean up any restart junk, then every 24 hours.
(
    sleep 300
    while true; do
        echo "🧹 Running daily cleanup..."
        node -e "fetch('http://127.0.0.1:3000/api/cron/cleanup', { headers: { 'Authorization': 'Bearer ' + process.env.CRON_SECRET } }).then(r => console.log('Cleanup status:', r.status)).catch(e => console.error('Cleanup failed:', e.message))" || echo "❌ Cleanup failed"

        sleep 86400
    done
) &

# Action: Cron Loop (Reminders)
# Strategy: Run every 10 minutes to ensure notifications are timely.
(
    sleep 60
    while true; do
        echo "🔔 Checking reminders..."
        node -e "fetch('http://127.0.0.1:3000/api/cron/reminders', { headers: { 'Authorization': 'Bearer ' + process.env.CRON_SECRET } }).then(r => console.log('Reminder check status:', r.status)).catch(e => console.error('Reminder check failed:', e.message))" || echo "❌ Reminder check failed"
        sleep 600
    done
) &

echo "✅ Cron loop started."

# Action: Start Server
echo "🟢 Starting Next.js server..."
exec node server.js
