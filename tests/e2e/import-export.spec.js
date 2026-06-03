// End-to-end tests for the company import and export feature (JST-44).
//
// These tests use Playwright's setInputFiles() to simulate file uploads and
// waitForEvent('download') to intercept triggered file downloads.
// The Python HTTP server is started automatically by playwright.config.js.
//
// Run with: npm run test:e2e

const { test, expect } = require('@playwright/test');

// Relative URL — resolves against baseURL ('http://localhost:8000') set in playwright.config.js
const APP_URL = '/job-search-toolkit.html';

// Minimal CSV fixture: one valid company row with pipe-separated tags
const IMPORT_CSV = [
  'name,location,url,tags,status,roleApplied,usefulInfo,lastClicked,lastUpdated',
  'Playwright Import Co,Dublin,https://playwright-import.example.com,EM|Test,,,,,'
].join('\n');

// ─── Test 1: Navigate to Company tracker ─────────────────────────────────────
// Guards the tests below: verifies the Companies panel is reachable before we
// attempt to interact with import/export controls inside it.
test('Company tracker panel is visible and import/export controls are present', async ({ page }) => {
  await page.goto(APP_URL);

  // Click the Company tracker nav button to ensure the panel is active
  await page.locator('nav button', { hasText: 'Company tracker' }).click();
  await expect(page.locator('#companies')).toBeVisible();

  // Import, Export CSV, and Export JSON buttons must all be present
  await expect(page.locator('button.io-btn', { hasText: 'Import' })).toBeVisible();
  await expect(page.locator('button.io-btn', { hasText: 'Export CSV' })).toBeVisible();
  await expect(page.locator('button.io-btn', { hasText: 'Export JSON' })).toBeVisible();
});

// ─── Test 2: Import CSV ───────────────────────────────────────────────────────
// Simulates uploading a valid CSV file and verifies the imported company card
// appears in the company grid without a page reload.
test('importing a valid CSV file adds the company to the grid', async ({ page }) => {
  await page.goto(APP_URL);
  await page.locator('nav button', { hasText: 'Company tracker' }).click();

  // Use setInputFiles to simulate a file upload on the hidden input
  await page.setInputFiles('#company-import-input', {
    name: 'companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(IMPORT_CSV)
  });

  // The imported company card must appear in the grid
  await expect(page.locator('.company-grid', { hasText: 'Playwright Import Co' })).toBeVisible();
});

// ─── Test 3: Import feedback message ─────────────────────────────────────────
// After a successful CSV import the feedback div must show a confirmation message
// containing the count of imported companies.
test('successful CSV import shows a feedback message with the import count', async ({ page }) => {
  await page.goto(APP_URL);
  await page.locator('nav button', { hasText: 'Company tracker' }).click();

  await page.setInputFiles('#company-import-input', {
    name: 'companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(IMPORT_CSV)
  });

  // The feedback element should become visible and report the imported count
  const feedback = page.locator('#import-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('imported');
});

// ─── Test 4: Export JSON triggers a download ──────────────────────────────────
// Clicks the Export JSON button and verifies a download is triggered with the
// expected filename pattern (companies-YYYY-MM-DD.json).
test('clicking Export JSON triggers a file download with a .json filename', async ({ page }) => {
  await page.goto(APP_URL);
  await page.locator('nav button', { hasText: 'Company tracker' }).click();

  // Wait for the download event before clicking the button so it's not missed
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button.io-btn', { hasText: 'Export JSON' }).click()
  ]);

  expect(download.suggestedFilename()).toMatch(/^companies-\d{4}-\d{2}-\d{2}\.json$/);
});

// ─── Test 5: Export CSV triggers a download ───────────────────────────────────
// Same as above but for the CSV export path.
test('clicking Export CSV triggers a file download with a .csv filename', async ({ page }) => {
  await page.goto(APP_URL);
  await page.locator('nav button', { hasText: 'Company tracker' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button.io-btn', { hasText: 'Export CSV' }).click()
  ]);

  expect(download.suggestedFilename()).toMatch(/^companies-\d{4}-\d{2}-\d{2}\.csv$/);
});
