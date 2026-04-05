#!/usr/bin/env bash
source "$(dirname "$0")/config.sh"

mkdir -p "$LOG_DIR"
npm run dev:api > "$API_LOG" 2>&1 &
npm run dev:landing < /dev/null > "$LANDING_LOG" 2>&1 &

echo "Dev servers started"
echo "  API:     http://localhost:$API_PORT"
echo "  Landing: http://localhost:$LANDING_PORT"
echo ""
echo "Run npm run log to watch output"
