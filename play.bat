@echo off
rem The Uncalled launcher (Windows): serves this folder locally and opens the game in your browser.
cd /d "%~dp0"
set PORT=8123
start "" "http://127.0.0.1:%PORT%/index.html"
echo The Uncalled is running at http://127.0.0.1:%PORT%/index.html
echo Keep this window open while you play. Close it to stop the local server.
python -m http.server %PORT% --bind 127.0.0.1 || py -m http.server %PORT% --bind 127.0.0.1
