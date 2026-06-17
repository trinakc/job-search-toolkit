// Playwright tests for derived company status (JST-64).
//
// The status badge on a company card is derived from the most recent update card by date,
// not from the legacy company.status field. These tests verify the rendered badge reacts to
// the update log; the pure derivation logic is unit-tested in app.test.js.

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
    roleApplied: '',
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

// Returns the status badge locator for a named company card.
function statusBadge(page, name) {
  return page.locator('.company-card', { hasText: name }).locator('.company-status');
}

test('the badge shows the status of the most recent update card', async ({ page }) => {
  await seedAndLoad(page, [
    company('Acme Corp', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Interviewing', date: '2026-06-14T00:00:00.000Z', notes: '' }
    ])
  ]);

  await expect(statusBadge(page, 'Acme Corp')).toHaveText('Interviewing');
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

  await expect(statusBadge(page, 'Acme Corp')).toHaveText('Applied');

  // Open the edit modal and add a newer card with a different status.
  await page.locator('.company-card', { hasText: 'Acme Corp' }).locator('.edit-btn').click();
  await page.click('#add-update-btn');
  await page.selectOption('#update-card-status', 'Offer');
  await page.fill('#update-card-date', '2026-06-20');
  await page.click('#update-card-save-btn');

  // Close the modal and confirm the grid badge now reflects the newest card.
  await page.locator('#add-company-modal .modal-actions button', { hasText: 'Cancel' }).click();
  await expect(statusBadge(page, 'Acme Corp')).toHaveText('Offer');
});
