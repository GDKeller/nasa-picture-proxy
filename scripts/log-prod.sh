#!/usr/bin/env bash
source "$(dirname "$0")/config.sh"

ACTION="${1:-start}"  # start | stop

case "$ACTION" in
  start)
    mkdir -p "$LOG_DIR"
    wrangler tail --format pretty > "$PROD_LOG" 2>&1 &
    echo "Production log started, writing to $PROD_LOG"
    ;;
  stop)
    pkill -f 'wrangler tail' 2>/dev/null \
      && echo "Production log stopped" \
      || echo "No production log running"
    ;;
  *) echo "Unknown action: $ACTION"; exit 1 ;;
esac
