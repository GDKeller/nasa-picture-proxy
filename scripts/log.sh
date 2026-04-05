#!/usr/bin/env bash
source "$(dirname "$0")/config.sh"

MODE="${1:-watch}"    # watch | tail
TARGET="${2:-all}"    # all | api | landing | prod

case "$TARGET" in
  api)     files="$API_LOG" ;;
  landing) files="$LANDING_LOG" ;;
  prod)    files="$PROD_LOG" ;;
  all)     files="$API_LOG $LANDING_LOG" ;;
  *)       echo "Unknown target: $TARGET"; exit 1 ;;
esac

case "$MODE" in
  watch) tail -f $files ;;
  tail)  tail -20 $files ;;
  *)     echo "Unknown mode: $MODE"; exit 1 ;;
esac
