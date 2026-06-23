// Playwright tests for the company-card remove confirmation (JST-75).
//
// The Remove button used to delete a company immediately. It now shows an inline
// confirmation step first. These tests cover the three user-facing paths that Jest
// cannot exercise (they are DOM behaviour):
//   1. Clicking Remove shows the confirmation and deletes nothing.
//   2. Cancel restores the card untouched.
//   3. "Yes, remove" deletes the card.
//
// The underlying deletion logic (removeCompany filtering localStorage) is unit-tested
// in app.test.js. Each test seeds its own data so it is self-contained.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// Two companies so we can assert the right one is removed and the other survives.
const FIXTURE_COMPANIES = [
  { name: 'Alpha Corp', location: 'Dublin', url: 'https://alpha.example.com', tags: [], lastClicked: null, status: null, usefulInfo: '', lastUpdated: null },
  { name: 'Beta Ltd',   location: 'Cork',   url: 'https://beta.example.com',  tags: [], lastClicked: null, status: null, usefulInfo: '', lastUpdated: null },
];

// Seeds FIXTURE_COMPANIES into localStorage, then reloads so the app renders them.
// Same pattern as company-sort-filter.spec.js: navigate to establish the origin,
// set localStorage, then reload to trigger the render.
async function seedAndLoad(page) {
  await page.goto(APP_URL);
  await page.evaluate((companies) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify(companies));
  }, FIXTURE_COMPANIES);
  await page.reload();
}

// Returns the names of the companies currently persisted in localStorage.
async function getStoredCompanyNames(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('jst_companies_v1');
    return raw ? JSON.parse(raw).map(c => c.name) : [];
  });
}

// Locates the .company-card whose .company-name matches the given name.
function cardFor(page, name) {
  return page.locator('.company-card', { has: page.locator('.company-name', { hasText: name }) });
}

// ─── Test 1: Remove shows confirmation and deletes nothing ────────────────────
test('clicking Remove shows the confirmation without deleting the company', async ({ page }) => {
  await seedAndLoad(page);

  const alphaCard = cardFor(page, 'Alpha Corp');
  await alphaCard.locator('.remove-btn').click();

  // The inline confirmation appears on that card, and the normal Remove button is gone.
  await expect(alphaCard.locator('.remove-confirm')).toBeVisible();
  await expect(alphaCard.locator('.remove-btn')).toHaveCount(0);

  // Nothing has been deleted: the card is still shown and still in localStorage.
  await expect(alphaCard).toBeVisible();
  expect(await getStoredCompanyNames(page)).toEqual(['Alpha Corp', 'Beta Ltd']);
});

// ─── Test 2: Cancel leaves the card intact ────────────────────────────────────
test('cancelling the confirmation keeps the company and restores the buttons', async ({ page }) => {
  await seedAndLoad(page);

  const alphaCard = cardFor(page, 'Alpha Corp');
  await alphaCard.locator('.remove-btn').click();
  await alphaCard.locator('.remove-confirm-cancel').click();

  // Normal buttons are back, the confirmation is gone, and no data was lost.
  await expect(alphaCard.locator('.remove-btn')).toBeVisible();
  await expect(alphaCard.locator('.remove-confirm')).toHaveCount(0);
  expect(await getStoredCompanyNames(page)).toEqual(['Alpha Corp', 'Beta Ltd']);
});

// ─── Test 3: Confirm removes the card ─────────────────────────────────────────
test('confirming the deletion removes the company card', async ({ page }) => {
  await seedAndLoad(page);

  const alphaCard = cardFor(page, 'Alpha Corp');
  await alphaCard.locator('.remove-btn').click();
  await alphaCard.locator('.remove-confirm-yes').click();

  // Alpha is gone from the DOM and from localStorage; Beta is untouched.
  await expect(cardFor(page, 'Alpha Corp')).toHaveCount(0);
  await expect(cardFor(page, 'Beta Ltd')).toBeVisible();
  expect(await getStoredCompanyNames(page)).toEqual(['Beta Ltd']);
});
