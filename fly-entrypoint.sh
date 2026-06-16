#!/usr/bin/env bash
# Fly.io entrypoint — restore SQLite from Litestream replica (if configured)
# then run the Node server. If Litestream env vars aren't set, fall back to
# launching the server directly so first-deploy / local testing still works.

set -euo pipefail

DB_PATH="${DATABASE_PATH:-/data/data.db}"
mkdir -p "$(dirname "$DB_PATH")"

if [[ -n "${LITESTREAM_REPLICA_URL:-}" ]]; then
  echo "[entrypoint] Litestream replica configured: ${LITESTREAM_REPLICA_URL}"

  # If the local DB is missing, try restoring from the replica.
  if [[ ! -f "$DB_PATH" ]]; then
    echo "[entrypoint] No local DB at $DB_PATH — attempting restore..."
    if litestream restore -if-replica-exists -o "$DB_PATH" "$DB_PATH"; then
      echo "[entrypoint] Restore complete."
    else
      echo "[entrypoint] No replica to restore from — starting with fresh DB."
    fi
  else
    echo "[entrypoint] Local DB present at $DB_PATH — skipping restore."
  fi

  # Run Litestream as parent so it replicates while the server runs.
  exec litestream replicate -exec "node /app/dist/index.cjs"
else
  echo "[entrypoint] No LITESTREAM_REPLICA_URL set — running server without replication."
  exec node /app/dist/index.cjs
fi
