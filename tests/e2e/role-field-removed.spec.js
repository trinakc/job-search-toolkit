// Playwright tests for the removal of the legacy company-level "Role applied for" field (JST-67).
//
// Role data now lives exclusively on update cards. These tests guard that:
//   - the company Edit modal no longer has a company-level role field (#company-role)
//   - company cards no longer have a "Show more info" expander
//   - the update-card form STILL has its own Role field (we removed the right one)
//
// Each test seeds a single company into localStorage before the page loads.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// A single saved company with one update card, so the Updates section is available in the modal.
function makeCompany() {
  return {
    name: 'Acme Corp',
    location: 'Dublin',
    url: 'https://acme.example.com/careers',
    tags: ['EM'],
    lastClicked: null,
    lastUpdated: null,
    updates: [
      { role: 'Engineering Manager', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'note' }
    ]
  };
}

async function seedAndLoad(page) {
  await page.goto(APP_URL);
  await page.evaluate((company) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([company]));
  }, makeCompany());
  await page.reload();
}

test('the company Edit modal has no "Role applied for" field', async ({ page }) => {
  await seedAndLoad(page);

  await page.locator('.company-card .edit-btn').first().click();
  await expect(page.locator('#add-company-modal')).toBeVisible();

  // The company-level role input is gone; the modal main fields remain.
  await expect(page.locator('#company-role')).toHaveCount(0);
  await expect(page.locator('#company-name')).toBeVisible();
});

test('company cards no longer have a "Show more info" expander', async ({ page }) => {
  await seedAndLoad(page);

  await expect(page.locator('.company-card')).toHaveCount(1);
  await expect(page.locator('.expand-btn')).toHaveCount(0);
  await expect(page.locator('.company-expanded')).toHaveCount(0);
});

test('the update-card form still has its own Role field', async ({ page }) => {
  await seedAndLoad(page);

  await page.locator('.company-card .edit-btn').first().click();
  await page.click('#add-update-btn');

  // The per-card role input is untouched by JST-67.
  await expect(page.locator('#update-card-role')).toBeVisible();
});
