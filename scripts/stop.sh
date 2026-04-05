#!/usr/bin/env bash
source "$(dirname "$0")/config.sh"

lsof -ti:"$API_PORT","$LANDING_PORT" | xargs kill 2>/dev/null \
  && echo "Dev servers stopped" \
  || echo "No servers running"
