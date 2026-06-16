# =============================================================================
# FreightClause Tender — backend image (Fly.io)
# Stage 1: build the Node bundle.
# Stage 2: slim runtime image with better-sqlite3 native binding + Litestream.
# =============================================================================

# ---- Stage 1: build -----------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Build tools needed to compile better-sqlite3 from source
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Compile client (Vite -> dist/public) and server (esbuild -> dist/index.cjs)
# VITE_API_BASE is intentionally NOT set in this image — the frontend lives on
# Cloudflare Pages and is built there with its own VITE_API_BASE. This Docker
# image only ships the backend, but we still build the client so /api is the
# only thing exposed in production.
RUN npm run build

# Prune devDependencies so we only carry runtime modules into stage 2
RUN npm prune --omit=dev

# ---- Stage 2: runtime ---------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Install Litestream (continuous SQLite replication, same pattern as FreightClause)
ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && wget -qO /tmp/litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.deb" \
 && dpkg -i /tmp/litestream.deb \
 && rm /tmp/litestream.deb \
 && apt-get purge -y wget \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# Copy built artefacts + pruned node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY litestream.yml /etc/litestream.yml
COPY fly-entrypoint.sh /app/fly-entrypoint.sh
RUN chmod +x /app/fly-entrypoint.sh

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/data.db

EXPOSE 8080

# fly-entrypoint.sh restores the DB from object storage (if configured) then
# launches `litestream replicate -exec` so replication runs as the app's parent
# process. On crash, Litestream forwards the exit code to Fly.
ENTRYPOINT ["/app/fly-entrypoint.sh"]
