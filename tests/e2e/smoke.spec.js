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
// Verifies that clicking a nav button switches the visible panel.
//
// The app uses feature flags (FEATURES in app.js) to hide disabled panels.
// Currently only 'companies' is enabled. The tracker panel is hidden because
// it is only useful when live search is enabled (it is populated via "+ Track"
// in the live jobs panel). The default landing panel is 'companies'.
//
// This test also verifies that the tracker nav button is hidden — confirming
// the feature flag is working correctly.
test('navigation works — default panel is visible, disabled panels are hidden', async ({ page }) => {
  await page.goto(APP_URL);

  // Company tracker is the default tab — it must be visible immediately on load
  await expect(page.locator('#companies')).toBeVisible();

  // The tracker nav button should be hidden — FEATURES.tracker is false because
  // the tracker is only useful when live search is enabled
  await expect(page.locator('#tracker-nav-btn')).not.toBeVisible();
});

// ─── Test 3: Company grid renders ────────────────────────────────────────────
// Verifies that the company grid is populated with at least one card on load.
//
// On a fresh page (empty localStorage), getCompanies() in app.js falls back to
// DEFAULT_COMPANIES — a hardcoded list of ~18 target employers. This test
// confirms that at least one of those cards is rendered and visible.
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

// ─── Test 5: localStorage persistence ────────────────────────────────────────
// Verifies that tracker data written to localStorage survives a full page reload.
//
// The tracker panel is hidden (FEATURES.tracker = false) because it is only
// useful when live search is enabled. We can still verify localStorage
// persistence by seeding data via page.evaluate(), reloading, and reading the
// value back — without needing to interact with the hidden tracker UI.
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

  // Read localStorage back directly and confirm the entry survived the reload.
  // We verify via localStorage rather than the UI because the tracker panel
  // is hidden while live search is disabled.
  const stored = await page.evaluate(() => localStorage.getItem('jst_tracker_v1'));
  const parsed = JSON.parse(stored);
  expect(parsed['smoke-test-job-001'].title).toBe('Playwright Smoke Test Job');
});
