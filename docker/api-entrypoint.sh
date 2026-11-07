#!/bin/sh
set -e
cd /app/apps/api

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  /app/apps/api/node_modules/.bin/prisma migrate deploy
fi

exec node dist/server.js
