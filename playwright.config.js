// Playwright configuration for job-search-toolkit UI (smoke) tests.
// Docs: https://playwright.dev/docs/test-configuration

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Where Playwright looks for test files
  testDir: './tests/e2e',

  // Maximum time (ms) a single test is allowed to run before it is marked as failed.
  // 30 s is generous for these smoke tests — raise it if a slow CI runner needs more.
  timeout: 30000,

  // How many times to retry a failed test before marking it as a failure.
  // 0 retries locally keeps feedback fast; CI can override via --retries flag if needed.
  retries: 0,

  // Terminal reporter — prints one line per test result, easy to read in CI logs
  reporter: 'list',

  use: {
    // Base URL for page.goto() calls — tests use relative paths like '/job-search-toolkit.html'
    baseURL: 'http://localhost:8000',

    // Capture a Playwright trace on the first retry of a failed test.
    // Traces can be opened with 'npx playwright show-trace trace.zip' for debugging.
    trace: 'on-first-retry',
  },

  // Run tests in Chromium only for now.
  // Additional browsers (firefox, webkit) can be added here when needed.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Playwright will start server.js before running tests and stop it when done.
  //
  // server.js replaces `python -m http.server 8000` because:
  //   - Python's http.server only serves static files
  //   - The Reed API does not allow direct browser requests (no CORS headers)
  //   - server.js serves static files AND proxies /api/reed/search to Reed
  //     server-side, where CORS does not apply
  //
  // reuseExistingServer behaviour:
  //   - Local dev (no CI env var):  reuse a server already on port 8000,
  //     so running `node server.js` manually first also works fine.
  //   - CI (process.env.CI is set): always start a fresh server to ensure a clean state.
  //
  // Node.js is pre-installed on GitHub's ubuntu-latest runners, so no extra
  // setup step is needed in CI.
  webServer: {
    command: 'node server.js',
    port: 8000,
    reuseExistingServer: !process.env.CI,
  },
});
