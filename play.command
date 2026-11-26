#!/bin/bash
# The Uncalled launcher (macOS): serves this folder locally and opens the game in your browser.
cd "$(dirname "$0")"
PORT=8123
if ! lsof -i tcp:$PORT >/dev/null 2>&1; then
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  sleep 1
fi
open "http://127.0.0.1:$PORT/index.html"
echo "The Uncalled is running at http://127.0.0.1:$PORT/index.html"
echo "Keep this window open while you play. Close it (or press Ctrl+C) to stop the local server."
[ -n "$SERVER" ] && wait $SERVER
