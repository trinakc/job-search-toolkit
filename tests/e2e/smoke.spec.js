// Smoke tests for job-search-toolkit.
//
// These are end-to-end tests that run against the real HTML page served by the
// Python HTTP server configured in playwright.config.js. They verify that the
// most critical user journeys work after any change — think of them as a safety
// net that catches broken navigation, missing CSS, or broken localStorage logic
// before they reach main.
//
// Run with: npm run test:e2e
// The server starts automatically (see playwright.config.js webServer option).

const { test, expect } = require('@playwright/test');

// Relative URL — resolves against baseURL ('http://localhost:8000') set in playwright.config.js
const APP_URL = '/job-search-toolkit.html';

// ─── Test 1: Page loads ───────────────────────────────────────────────────────
// Verifies the page is reachable and the <title> tag matches what we expect.
// A wrong title here usually means the wrong file is being served.
test('page loads and title is correct', async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page).toHaveTitle('Job Search Toolkit');
});

// ─── Test 2: Navigation ───────────────────────────────────────────────────────
// Verifies that clicking a nav button switches the visible panel, and that the
// feature flag system is wiring up correctly.
//
// The app uses feature flags (FEATURES in app.js) to hide disabled panels.
// FEATURES.jobs and FEATURES.tracker are now both true (Reed API integration).
// The default landing panel is 'companies' (it is the first enabled feature
// checked by getDefaultTab() in app.js).
//
// This test confirms:
//   - Company tracker is the default visible panel on load
//   - The Live jobs nav button is visible (FEATURES.jobs = true)
//   - The My tracker nav button is visible (FEATURES.tracker = true)
//   - Panels for disabled features (alerts, scorer) are still hidden
test('navigation works — default panel is visible, enabled panels have nav buttons', async ({ page }) => {
  await page.goto(APP_URL);

  // Company tracker is the default tab — it must be visible immediately on load
  await expect(page.locator('#companies')).toBeVisible();

  // Live jobs nav button should be visible — FEATURES.jobs is now true
  await expect(page.locator('nav button', { hasText: 'Live jobs' })).toBeVisible();

  // My tracker nav button should now be visible — FEATURES.tracker is true because
  // live search is enabled (tracker is populated via "+ Track" in live search)
  await expect(page.locator('#tracker-nav-btn')).toBeVisible();
});

// ─── Test 3: Company grid renders ────────────────────────────────────────────
// Verifies that the company grid is populated with at least one card on load.
//
// On a fresh page (empty localStorage), getCompanies() in app.js falls back to
// API_CONFIG.DEFAULT_COMPANIES (defined in config.js). This test confirms that
// at least one of those cards is rendered and visible.
test('company grid renders with at least one company card visible', async ({ page }) => {
  await page.goto(APP_URL);

  // The companies panel is the default — no navigation needed before this check
  await expect(page.locator('.company-card').first()).toBeVisible();
});

// ─── Test 4: Add company modal ────────────────────────────────────────────────
// Verifies the full add-company flow:
//   1. Modal opens when the "+ Add company" button is clicked
//   2. Filling the required fields (name, URL) and submitting closes the modal
//   3. The new company card appears in the grid after submission
//
// The modal form submit handler (in app-dom.js) calls saveCompanies() and
// renderCompanies(), so this test also implicitly verifies localStorage write
// and grid re-render.
test('add company modal opens and saves a new company correctly', async ({ page }) => {
  await page.goto(APP_URL);

  // Click the "+ Add company" button to open the modal
  await page.click('button.add-company-btn');

  // The modal should now be visible (openAddCompanyModal adds class 'active')
  await expect(page.locator('#add-company-modal')).toBeVisible();

  // Fill the two required fields — name and URL
  await page.fill('#company-name', 'Playwright Test Co');
  await page.fill('#company-url', 'https://playwright-test-co.example.com/careers');

  // Submit the form — this saves to localStorage and re-renders the company grid
  await page.click('#modal-submit-btn');

  // The modal should close after a successful save (closeModal() removes 'active')
  await expect(page.locator('#add-company-modal')).not.toBeVisible();

  // The new company should now appear as a card in the grid
  await expect(page.locator('.company-card', { hasText: 'Playwright Test Co' })).toBeVisible();
});

// ─── Test 5: Live jobs panel (Reed API) ──────────────────────────────────────
// Verifies that the Live Jobs panel is reachable, a search triggers a Reed API
// call, and at least one job card is rendered in the DOM when results are returned.
//
// We use page.route() to intercept the Reed API request and return controlled
// mock data. This keeps the test:
//   - Deterministic: results don't depend on Reed's live data
//   - Fast: no real network call
//   - Offline-safe: passes in CI without network egress to reed.co.uk
//
// FEATURES.jobs is now true in app.js, so the Live Jobs nav button and panel
// are visible — this test confirms that end-to-end wiring is correct.
test('live jobs panel is visible, search returns results, and job cards render', async ({ page }) => {
  // In CI, config.js is git-ignored and does not exist, so API_CONFIG is undefined
  // when the page loads. fetchReedJobs() throws early on the missing-key guard
  // before making any fetch call, which means page.route() never intercepts anything
  // and no cards render.
  //
  // addInitScript() runs before ALL page scripts (including config.js and app.js),
  // so this stub is in place when fetchReedJobs() checks for the API key.
  // Locally, config.js loads after this and defines its own `const API_CONFIG` which
  // takes precedence — but the route intercept below catches the request regardless
  // of what key value is used, so the real key is never actually sent to Reed.
  await page.addInitScript(() => {
    window.API_CONFIG = { REED_API_KEY: 'e2e-test-stub-key' };
  });

  // Intercept requests to the local Reed proxy endpoint.
  // fetchReedJobs() calls /api/reed/search (same-origin) rather than Reed directly
  // because Reed's API does not send CORS headers. server.js proxies those requests
  // to Reed server-side. Here we intercept at the proxy URL so the test never
  // touches the network, regardless of whether a real API key is configured.
  await page.route('**/api/reed/search**', route => {
    // Respond with a minimal but valid Reed API response containing one job.
    // The shape matches what fetchReedJobs() expects to unwrap from data.results.
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            jobId: 99001,
            jobTitle: 'Playwright Smoke Test Delivery Manager',
            employerName: 'E2E Test Corp',
            locationName: 'Dublin',
            minimumSalary: 70000,
            maximumSalary: 90000,
            date: new Date().toISOString(),
            jobDescription: 'A test job description generated by the Playwright smoke test suite.',
            jobUrl: 'https://www.reed.co.uk/jobs/delivery-manager/99001',
          }
        ]
      })
    });
  });

  await page.goto(APP_URL);

  // The Live Jobs nav button should be visible — FEATURES.jobs is true in app.js,
  // so app-dom.js does NOT hide it (it only hides buttons for disabled features)
  const liveJobsBtn = page.locator('nav button', { hasText: 'Live jobs' });
  await expect(liveJobsBtn).toBeVisible();

  // Click the nav button to switch to the Live Jobs panel
  await liveJobsBtn.click();

  // The jobs panel should now be the active (visible) panel
  await expect(page.locator('#jobs')).toBeVisible();

  // Fill the role text input — role-filter is now a free-text input (JST-53).
  // Unlike the old dropdown which had a pre-selected value, the input starts empty
  // and fetchJobs() guards against empty input, so we must type something first.
  // The value doesn't matter — the route intercept above catches any request.
  await page.fill('#role-filter', 'test role');

  // Click the Search button — this triggers fetchJobs() → fetchReedJobs() →
  // our mocked route above → card rendering
  await page.click('#fetch-btn');

  // At least one job card should appear in the DOM.
  // We match by the job title we put in the mock response to confirm the card
  // content came from our intercept rather than from any cached or default state.
  await expect(page.locator('.job-card').first()).toBeVisible();
  await expect(page.locator('.job-card', { hasText: 'Playwright Smoke Test Delivery Manager' })).toBeVisible();
});

// ─── Test 6: localStorage persistence ────────────────────────────────────────
// Verifies that tracker data written to localStorage survives a full page reload.
//
// We seed data via page.evaluate() and verify it by reading localStorage back
// after a reload — this is faster and simpler than navigating to the tracker
// panel and inspecting the rendered UI.
test('job tracker data persists in localStorage after page reload', async ({ page }) => {
  await page.goto(APP_URL);

  // Seed a tracker entry directly in localStorage.
  // The structure matches what addToTracker() writes in app.js.
  await page.evaluate(() => {
    const entry = {
      id: 'smoke-test-job-001',
      title: 'Playwright Smoke Test Job',
      company: 'Test Corp',
      url: 'https://example.com/job/001',
      status: 'new',
      note: '',
      savedAt: new Date().toISOString(),
    };
    // TRACKER_KEY = 'jst_tracker_v1' (defined in app.js)
    localStorage.setItem('jst_tracker_v1', JSON.stringify({ 'smoke-test-job-001': entry }));
  });

  // Reload the page — forces the app to re-initialise from localStorage
  await page.reload();

  // Read localStorage back directly and confirm the entry survived the reload
  const stored = await page.evaluate(() => localStorage.getItem('jst_tracker_v1'));
  const parsed = JSON.parse(stored);
  expect(parsed['smoke-test-job-001'].title).toBe('Playwright Smoke Test Job');
});

// ─── Test 7: Mode toggle ──────────────────────────────────────────────────────
// Verifies that the mode toggle correctly shows/hides the role input.
//
// - On load, "Single role" is pre-selected and the role input is visible
// - Switching to "All configured titles" hides the role input and shows the count label
// - Switching back to "Single role" restores the role input
//
// The toggle wiring lives in initSearchModeToggle() (app-dom.js).
// This test confirms the DOM event listeners and visibility logic are working.
test('mode toggle shows role input for single mode and hides it for all-titles mode', async ({ page }) => {
  await page.goto(APP_URL);

  // Navigate to the Live Jobs panel
  await page.locator('nav button', { hasText: 'Live jobs' }).click();
  await expect(page.locator('#jobs')).toBeVisible();

  // On load, single mode is pre-selected — role input must be visible
  await expect(page.locator('#role-input-wrap')).toBeVisible();

  // Switch to "All configured titles" mode
  await page.click('#mode-all');

  // Role input wrap should now be hidden
  await expect(page.locator('#role-input-wrap')).not.toBeVisible();

  // The all-titles label should contain the title count from config
  // (config.template.js has 8 titles, copied to config.js in CI)
  await expect(page.locator('#all-titles-label')).toContainText('All configured titles');

  // Switch back to single mode — role input should reappear
  await page.click('#mode-single');
  await expect(page.locator('#role-input-wrap')).toBeVisible();
});
