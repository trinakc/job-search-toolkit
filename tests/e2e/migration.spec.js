// Playwright tests for the one-time legacy-data migration (JST-65).
//
// On load, runCompanyMigration() folds each company's legacy usefulInfo + status into a single
// update card and removes the old fields. These tests verify the end-to-end effect via the UI;
// the migration logic itself is unit-tested in app.test.js.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// A legacy-shaped company (pre-Update-Log): has usefulInfo + lowercase status, and no updates array.
function legacyCompany(name, status, usefulInfo) {
  return {
    name,
    location: 'Dublin',
    url: `https://${name.toLowerCase().replace(/\s+/g, '')}.example.com/careers`,
    tags: ['EM'],
    lastClicked: null,
    status,
    roleApplied: '',
    usefulInfo
    // intentionally no `updates` key — this is old data predating JST-62
  };
}

async function seedAndLoad(page, companies) {
  await page.goto(APP_URL);
  await page.evaluate((data) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify(data));
  }, companies);
  await page.reload();
}

function statusBadge(page, name) {
  return page.locator('.company-card', { hasText: name }).locator('.company-status');
}

test('migration derives the badge from the migrated legacy status', async ({ page }) => {
  await seedAndLoad(page, [legacyCompany('Acme Corp', 'applied', 'Met the hiring manager')]);

  // Legacy 'applied' maps to the 'Applied' update status, which drives the derived badge.
  await expect(statusBadge(page, 'Acme Corp')).toHaveText('Applied');
});

test('migration creates one update card carrying the old useful-info text as notes', async ({ page }) => {
  await seedAndLoad(page, [legacyCompany('Acme Corp', 'interviewing', 'Phone screen went well')]);

  // Open the edit modal and confirm exactly one migrated card with the old notes.
  await page.locator('.company-card', { hasText: 'Acme Corp' }).locator('.edit-btn').click();
  await expect(page.locator('#add-company-modal')).toBeVisible();

  const cards = page.locator('.update-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Phone screen went well');
  await expect(cards.first().locator('.update-status-badge')).toHaveText('Interviewing');
});

test('a legacy company with blank fields migrates to no card and shows "No updates"', async ({ page }) => {
  await seedAndLoad(page, [legacyCompany('Beta Ltd', null, '')]);

  await expect(statusBadge(page, 'Beta Ltd')).toHaveText('No updates');

  await page.locator('.company-card', { hasText: 'Beta Ltd' }).locator('.edit-btn').click();
  await expect(page.locator('.update-cards-empty')).toBeVisible();
});

test('migration persists — the legacy fields do not come back after a reload', async ({ page }) => {
  await seedAndLoad(page, [legacyCompany('Acme Corp', 'offer', 'Verbal offer made')]);

  // After the first load the migration has run and saved. Reloading must not create a second card.
  await page.reload();
  await page.locator('.company-card', { hasText: 'Acme Corp' }).locator('.edit-btn').click();
  await expect(page.locator('.update-card')).toHaveCount(1);

  // The stored company no longer carries the legacy keys.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jst_companies_v1'))[0]);
  expect('usefulInfo' in stored).toBe(false);
  expect('status' in stored).toBe(false);
});
