# ==============================================================================
# ARCHITECTURE: Multi-Stage Docker Build
#
# STRATEGY:
# 1. Base:    Common Alpine node environment + telemetry config.
# 2. Deps:    Clean install of dependencies (cached layer).
# 3. Builder: Full source compilation with Privacy Hardening enabled.
# 4. Runner:  Production runtime. Includes 'start.sh' wrapper for auto-migrations.
#
# PRIVACY GUARANTEES:
# - NEXT_TELEMETRY_DISABLED=1 (Hardcoded)
# - NEXT_PUBLIC_IS_HOSTED=false (Hardcoded alias in Webpack)
# ==============================================================================
FROM node:18-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------------------
# STAGE 2: Dependencies
# OBJECTIVE: Install node_modules in a separate cached layer.
# ------------------------------------------------------------------------------
FROM base AS deps
# ARCHITECTURE NOTE: 'libc6-compat' is required for potential native modules on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
    if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
    else echo "Lockfile not found." && exit 1; \
    fi

# ------------------------------------------------------------------------------
# STAGE 3: Builder
# OBJECTIVE: Compile source code into Next.js Standalone artifacts.
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# SECURITY & PRIVACY HARDENING
# ASSERTION: The Docker image MUST act as a "Self-Hosted" instance.
# ACTION: Force 'IS_HOSTED' to false to trigger Webpack aliasing of Ad components to NoOp.
ARG IS_DOCKER_BUILD=true
ENV IS_DOCKER_BUILD=true
ENV NEXT_PUBLIC_IS_HOSTED=false
RUN npx prisma generate



RUN \
    if [ -f yarn.lock ]; then yarn run build; \
    elif [ -f package-lock.json ]; then npm run build; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi

# ------------------------------------------------------------------------------
# STAGE 4: Production Runner
# OBJECTIVE: Minimalist runtime environment.
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

ENV NEXT_PUBLIC_IS_HOSTED=false

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat


# IO LAYER: Persistent Storage
# The /app/data volume is the single source of truth for the SQLite database.
# PERMISSION: User 'node' (UID 1000) must own this directory.
RUN mkdir -p /app/data && chown -R node:node /app/data

# Stay as root for setup commands to avoid permission issues during build
# USER node (will switch at the very end)

COPY --from=builder /app/public ./public

# PRE-RENDER CACHE (Permissions Fix)
RUN mkdir .next
RUN chown node:node .next

# ARTIFACT EXTRACTION
# Use 'standalone' output to minimize image size by only copying necessary chunks.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# ARCHITECTURAL DECISION: Self-Contained Migrations
#
# RATIONALE:
# To simplify the self-hosted user experience ("One-Click Start"), this container
# assumes responsibility for its own schema state.
#
# IMPLEMENTATION:
# We explicitly copy the Prisma CLI and engines from the 'builder' stage.
# This allows 'start.sh' to execute 'npx prisma migrate deploy' on startup.
#
# TRADEOFF:
# Increases image size slightly, but removes the need for an external 'initContainer'.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

# Fix permissions so node user can run prisma (which might download engines or write logs)
RUN chown -R node:node /app/node_modules

COPY prisma ./prisma
COPY start.sh ./
RUN chmod +x start.sh && chown node:node start.sh

# Switch to node user (UID 1000) for runtime
USER node

EXPOSE 3000

ENV PORT=3000
# NETWORK BINDING:
# Bind to 0.0.0.0 to ensure the app is accessible outside the container.
ENV HOSTNAME="0.0.0.0"

# ENTRYPOINT STRATEGY
# We use a wrapper script 'start.sh' instead of direct 'node server.js'
# to orchestrate the migration-before-startup sequence.
CMD ["./start.sh"]
