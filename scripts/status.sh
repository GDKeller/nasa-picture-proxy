#!/usr/bin/env bash
source "$(dirname "$0")/config.sh"

check() {
  lsof -ti:"$1" >/dev/null 2>&1 && echo "running" || echo "stopped"
}

echo "API ($API_PORT): $(check $API_PORT)"
echo "Landing ($LANDING_PORT): $(check $LANDING_PORT)"
echo "Prod log: $(pgrep -f 'wrangler tail' >/dev/null 2>&1 && echo 'running' || echo 'stopped')"
