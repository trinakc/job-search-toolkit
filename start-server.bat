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
::   2. Starts a Python HTTP server on port 8000 in this window.
::      The server must be running for the page to load — if the
::      browser opens before the server is ready, just refresh.
::
:: Prerequisites:
::   - Python 3 must be installed and on your PATH.
::     Verify with: python --version
::   - Run this script from the repo root (the folder that
::     contains job-search-toolkit.html).
::
:: To stop the server: close this window, or press Ctrl+C.
:: ============================================================

:: Open the toolkit URL in the default browser.
:: "start" with a URL delegates to Windows Shell — it does not
:: open a new cmd window; it opens the URL in the default browser.
start http://localhost:8000/job-search-toolkit.html

:: Start the Python built-in HTTP server on port 8000.
:: This serves all files in the current directory, which is why
:: the script must be run from the repo root.
:: A local server is required to avoid CORS errors that occur
:: when the HTML file is opened directly via the file:// protocol.
python -m http.server 8000
