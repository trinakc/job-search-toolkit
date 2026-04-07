// Playwright tests for company sort and filter controls (JST-13).
//
// These tests verify DOM behaviour — that the controls exist, that selecting
// options changes which cards are visible and in what order, and that combined
// filter + sort works correctly on the rendered grid.
//
// Pure logic (null handling, case-insensitivity, edge cases) is covered by
// the Jest unit tests in app.test.js. These tests cover only what Jest cannot:
// the UI responding correctly to user interaction.
//
// Every test seeds its own company data into localStorage before the page loads,
// so tests are fully self-contained and independent of the DEFAULT_COMPANIES list.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Minimal company objects — only the fields the sort/filter logic uses.
// Using simple names (Alpha, Beta, Gamma) makes ordering assertions easy to read.

const TODAY = new Date().toISOString();
const OLD_DATE = '2024-01-01T00:00:00.000Z';   // well outside any N-day window

const FIXTURE_COMPANIES = [
  // Beta comes first in the array so default alpha-asc sort is a visible change
  { name: 'Beta Ltd',   location: 'Dublin', url: 'https://beta.example.com',  tags: ['EM', 'Scrum'],    lastClicked: TODAY,     status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Alpha Corp', location: 'Dublin', url: 'https://alpha.example.com', tags: ['EM', 'Delivery'], lastClicked: OLD_DATE,  status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Gamma GmbH', location: 'Dublin', url: 'https://gamma.example.com', tags: [],                 lastClicked: null,      status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
];

// Seeds FIXTURE_COMPANIES into localStorage before navigating to the page.
// Must be called before page.goto() — localStorage is set on the origin, and
// goto() is what triggers the app to read it.
async function seedAndLoad(page) {
  // Navigate first to establish the origin, then set localStorage, then reload
  await page.goto(APP_URL);
  await page.evaluate((companies) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify(companies));
  }, FIXTURE_COMPANIES);
  await page.reload();
}

// Returns the text of every visible .company-name element.
async function getVisibleCompanyNames(page) {
  return page.locator('.company-name').allTextContents();
}

// ─── Test 1: Controls exist with expected options ─────────────────────────────
test('sort and filter controls exist with the expected options', async ({ page }) => {
  await seedAndLoad(page);

  await expect(page.locator('#company-sort')).toBeVisible();
  await expect(page.locator('#company-sort option[value="alpha-asc"]')).toHaveCount(1);
  await expect(page.locator('#company-sort option[value="alpha-desc"]')).toHaveCount(1);
  await expect(page.locator('#company-sort option[value="date-asc"]')).toHaveCount(1);
  await expect(page.locator('#company-sort option[value="date-desc"]')).toHaveCount(1);

  await expect(page.locator('#company-tag-filter')).toBeVisible();
  await expect(page.locator('#company-tag-filter option[value=""]')).toHaveCount(1);

  await expect(page.locator('#company-date-filter')).toBeVisible();
  await expect(page.locator('#company-date-filter option[value=""]')).toHaveCount(1);
  await expect(page.locator('#company-date-filter option[value="7"]')).toHaveCount(1);
  await expect(page.locator('#company-date-filter option[value="14"]')).toHaveCount(1);
  await expect(page.locator('#company-date-filter option[value="30"]')).toHaveCount(1);
});

// ─── Test 2: Default sort is alphabetical ascending ───────────────────────────
// Fixtures are seeded with Beta first in the array. The default sort (alpha-asc)
// should put Alpha first — confirming the sort is applied, not just array order.
test('default sort is alphabetical ascending', async ({ page }) => {
  await seedAndLoad(page);

  const names = await getVisibleCompanyNames(page);
  expect(names[0]).toBe('Alpha Corp');
  expect(names[1]).toBe('Beta Ltd');
  expect(names[2]).toBe('Gamma GmbH');
});

// ─── Test 3: Alphabetical descending reorders cards Z→A ──────────────────────
test('selecting Z→A sort reorders cards correctly', async ({ page }) => {
  await seedAndLoad(page);

  await page.selectOption('#company-sort', 'alpha-desc');

  const names = await getVisibleCompanyNames(page);
  expect(names[0]).toBe('Gamma GmbH');
  expect(names[1]).toBe('Beta Ltd');
  expect(names[2]).toBe('Alpha Corp');
});

// ─── Test 4: Last checked sort changes card order ─────────────────────────────
// Alpha was checked OLD_DATE (oldest), Beta was checked TODAY (newest),
// Gamma was never checked (null — always sinks to bottom).
// date-asc: Alpha, Beta, Gamma
// date-desc: Beta, Alpha, Gamma
test('last checked ascending puts oldest-checked first, nulls last', async ({ page }) => {
  await seedAndLoad(page);

  await page.selectOption('#company-sort', 'date-asc');

  const names = await getVisibleCompanyNames(page);
  expect(names[0]).toBe('Alpha Corp');  // oldest date
  expect(names[1]).toBe('Beta Ltd');    // newer date
  expect(names[2]).toBe('Gamma GmbH'); // null — always last
});

test('last checked descending puts newest-checked first, nulls last', async ({ page }) => {
  await seedAndLoad(page);

  await page.selectOption('#company-sort', 'date-desc');

  const names = await getVisibleCompanyNames(page);
  expect(names[0]).toBe('Beta Ltd');    // checked today — newest
  expect(names[1]).toBe('Alpha Corp');  // checked OLD_DATE
  expect(names[2]).toBe('Gamma GmbH'); // null — always last
});

// ─── Test 5: Tag filter shows only matching cards ─────────────────────────────
// Alpha and Beta both have 'EM'. Gamma has no tags.
// Filtering for 'EM' should hide Gamma.
test('filtering by tag shows only companies with that tag', async ({ page }) => {
  await seedAndLoad(page);

  await page.selectOption('#company-tag-filter', 'EM');

  const names = await getVisibleCompanyNames(page);
  expect(names).toContain('Alpha Corp');
  expect(names).toContain('Beta Ltd');
  expect(names).not.toContain('Gamma GmbH');
});

// ─── Test 6: Clearing tag filter restores all cards ───────────────────────────
test('clearing the tag filter restores all cards', async ({ page }) => {
  await seedAndLoad(page);

  // Apply then clear
  await page.selectOption('#company-tag-filter', 'EM');
  await page.selectOption('#company-tag-filter', '');

  const names = await getVisibleCompanyNames(page);
  expect(names).toHaveLength(3);
});

// ─── Test 7: Date filter hides recently-checked companies ─────────────────────
// Beta was checked TODAY — within any N-day window — so it should be hidden.
// Alpha was checked OLD_DATE (2024) — stale, should be shown.
// Gamma was never checked (null) — always shown in staleness filters.
test('date filter hides companies checked within the threshold', async ({ page }) => {
  await seedAndLoad(page);

  await page.selectOption('#company-date-filter', '7');

  const names = await getVisibleCompanyNames(page);
  expect(names).not.toContain('Beta Ltd');   // checked today — fresh
  expect(names).toContain('Alpha Corp');     // checked in 2024 — stale
  expect(names).toContain('Gamma GmbH');    // never checked — always included
});

// ─── Test 8: Edit/expand operate on the correct company after sort/filter ────
// Regression test for the bug where rendered card index was passed directly to
// openEditCompanyModal() and saveCompanyInfo(). After filtering, card position 0
// no longer corresponds to getCompanies()[0], so using the map index would open
// the wrong company's data in the modal.
//
// This test applies a tag filter so that Alpha Corp is the first (and only)
// rendered card, then clicks its Edit button. The modal must show Alpha Corp's
// name — not Gamma GmbH's (which is getCompanies()[0] in insertion order).
test('clicking Edit after filtering opens the correct company, not the one at that array position', async ({ page }) => {
  await seedAndLoad(page);

  // Gamma GmbH is first in the fixture array (insertion order).
  // After filtering for 'Delivery' (only Alpha Corp has it), Alpha Corp
  // will be at rendered position 0. If the bug is present, clicking Edit
  // on that card would open Gamma GmbH's data instead.
  await page.selectOption('#company-tag-filter', 'Delivery');

  // Only Alpha Corp should be visible after the filter
  const names = await getVisibleCompanyNames(page);
  expect(names).toEqual(['Alpha Corp']);

  // Click the Edit button on the first (only) visible card
  await page.locator('.edit-btn').first().click();

  // The modal must show Alpha Corp's name, not Gamma GmbH's
  await expect(page.locator('#company-name')).toHaveValue('Alpha Corp');
});

// ─── Test 9: Sort works on a filtered set ────────────────────────────────────
// After filtering to 'EM' (Alpha + Beta), switching sort should reorder those
// two cards without re-introducing Gamma or losing either Alpha or Beta.
test('sort works correctly on a filtered set', async ({ page }) => {
  await seedAndLoad(page);

  // Filter first
  await page.selectOption('#company-tag-filter', 'EM');

  // Default sort: alpha-asc → Alpha, Beta
  const asc = await getVisibleCompanyNames(page);
  expect(asc).toEqual(['Alpha Corp', 'Beta Ltd']);

  // Switch to alpha-desc → Beta, Alpha
  await page.selectOption('#company-sort', 'alpha-desc');
  const desc = await getVisibleCompanyNames(page);
  expect(desc).toEqual(['Beta Ltd', 'Alpha Corp']);

  // Gamma must not have reappeared
  expect(desc).not.toContain('Gamma GmbH');
});
