// Playwright tests for derived company status (JST-64).
//
// A company's status comes from the most recent update card by date, not the legacy
// company.status field. Since JST-83 the cards no longer show a single derived badge — each
// update is a "{role} {status}" summary pill, newest first — so "most recent status" is the
// first pill. These tests verify the rendered summary reacts to the update log; the pure
// derivation logic is unit-tested in app.test.js.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// Builds a company with the given updates array (other fields are unused by the badge).
function company(name, updates) {
  return {
    name,
    location: 'Dublin',
    url: `https://${name.toLowerCase().replace(/\s+/g, '')}.example.com/careers`,
    tags: ['EM'],
    lastClicked: null,
    status: null,
    usefulInfo: '',
    lastUpdated: null,
    updates: updates || []
  };
}

// Seeds the given companies into localStorage and loads the app.
async function seedAndLoad(page, companies) {
  await page.goto(APP_URL);
  await page.evaluate((data) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify(data));
  }, companies);
  await page.reload();
}

// Returns the neutral status badge locator for a named company card (only shown for no-update companies).
function statusBadge(page, name) {
  return page.locator('.company-card', { hasText: name }).locator('.company-status');
}

// Returns the first (newest) "{role} {status}" summary pill for a named company card.
function firstPill(page, name) {
  return page.locator('.company-card', { hasText: name }).locator('.company-update-summary').first();
}

test('the newest update card appears first in the summary pills', async ({ page }) => {
  await seedAndLoad(page, [
    company('Acme Corp', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Interviewing', date: '2026-06-14T00:00:00.000Z', notes: '' }
    ])
  ]);

  // Newest by date is the Interviewing card, so it heads the pill list.
  await expect(firstPill(page, 'Acme Corp')).toHaveText('EM interviewing');
});

test('a company with no update cards shows the neutral "No updates" badge', async ({ page }) => {
  await seedAndLoad(page, [company('Beta Ltd', [])]);

  await expect(statusBadge(page, 'Beta Ltd')).toHaveText('No updates');
});

test('adding a more recent update card updates the derived badge', async ({ page }) => {
  await seedAndLoad(page, [
    company('Acme Corp', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }
    ])
  ]);

  // JST-83: the single update shows as a "{role} {status}" pill (status lowercased).
  await expect(firstPill(page, 'Acme Corp')).toHaveText('EM applied');

  // Open the edit modal and add a newer card with a different status (no role entered).
  await page.locator('.company-card', { hasText: 'Acme Corp' }).locator('.edit-btn').click();
  await page.click('#add-update-btn');
  await page.selectOption('#update-card-status', 'Offer');
  await page.fill('#update-card-date', '2026-06-20');
  await page.click('#update-card-save-btn');

  // Close the modal and confirm the newest card now heads the pill list. With no role, the
  // pill falls back to the status alone ("Offer").
  await page.locator('#add-company-modal .modal-actions button', { hasText: 'Cancel' }).click();
  await expect(firstPill(page, 'Acme Corp')).toHaveText('Offer');
});
