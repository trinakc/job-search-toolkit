@echo off
:: ============================================================
:: start-server.bat
:: Local development server launcher for Job Search Toolkit
::
:: Usage: double-click this file in Windows Explorer, or run
::        it from a terminal with:  .\start-server.bat
::
:: What it does:
::   1. Opens http://localhost:8000/job-search-toolkit.html in
::      your default browser using the Windows "start" command.
::      "start" is non-blocking — it hands the URL to Windows
::      and returns immediately, so the next line runs right away.
::   2. Starts the Node.js server (server.js) on port 8000.
::      The server must be running for the page to load — if the
::      browser opens before the server is ready, just refresh.
::
:: WHY NODE INSTEAD OF PYTHON
::   The Reed.co.uk API does not send CORS headers, so direct
::   browser requests to Reed are blocked. server.js serves the
::   static files AND proxies /api/reed/search to Reed server-side
::   (server-to-server calls are not subject to CORS).
::
:: Prerequisites:
::   - Node.js must be installed and on your PATH.
::     Verify with: node --version
::   - Run this script from the repo root (the folder that
::     contains job-search-toolkit.html).
::
:: To stop the server: close this window, or press Ctrl+C.
:: ============================================================

:: Open the toolkit URL in the default browser.
:: "start" with a URL delegates to Windows Shell — it does not
:: open a new cmd window; it opens the URL in the default browser.
start http://localhost:8000/job-search-toolkit.html

:: Start the Node.js server.
:: server.js serves all files in the repo root AND proxies Reed API
:: calls, which is why it replaces the old Python http.server.
node server.js
