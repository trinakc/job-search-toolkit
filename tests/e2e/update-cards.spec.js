// Playwright tests for Add/Edit/Delete of update cards in the company modal (JST-63).
//
// These cover the UI behaviour Jest can't: opening the edit modal, the inline add/edit
// panel, and the rendered card list responding to user interaction. The underlying
// add/edit/delete logic and validation are unit-tested in app.test.js.
//
// Each test seeds its own company into localStorage before the page loads, so the tests
// are self-contained and independent of the DEFAULT_COMPANIES list.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// A single company. Some tests seed it with a pre-existing update card (for edit/delete);
// the helper takes the updates array so each test controls its own starting state.
function makeCompany(updates) {
  return {
    name: 'Acme Corp',
    location: 'Dublin',
    url: 'https://acme.example.com/careers',
    tags: ['EM'],
    lastClicked: null,
    status: null,
    roleApplied: '',
    usefulInfo: '',
    lastUpdated: null,
    updates: updates || []
  };
}

// Seeds one company into localStorage, then opens its edit modal.
async function seedAndOpenModal(page, updates) {
  await page.goto(APP_URL);
  await page.evaluate((company) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([company]));
  }, makeCompany(updates));
  await page.reload();

  // Open the edit modal via the company card's Edit button.
  await page.locator('.company-card .edit-btn').first().click();
  await expect(page.locator('#add-company-modal')).toBeVisible();
}

test('the Updates section is visible when editing a saved company', async ({ page }) => {
  await seedAndOpenModal(page);

  await expect(page.locator('#update-cards-section')).toBeVisible();
  // With no cards seeded, the empty state shows.
  await expect(page.locator('.update-cards-empty')).toBeVisible();
});

test('adding an update card shows it in the list with a status badge', async ({ page }) => {
  await seedAndOpenModal(page);

  await page.click('#add-update-btn');
  await page.fill('#update-card-role', 'Engineering Manager');
  await page.selectOption('#update-card-status', 'Applied');
  await page.fill('#update-card-date', '2026-06-10');
  await page.fill('#update-card-notes', 'Applied via referral');
  await page.click('#update-card-save-btn');

  // The new card renders with its role, notes, and a status badge.
  const card = page.locator('.update-card').first();
  await expect(card).toContainText('Engineering Manager');
  await expect(card).toContainText('Applied via referral');
  await expect(card.locator('.update-status-badge')).toHaveText('Applied');

  // It persists: reopening the modal after a reload still shows it.
  await page.reload();
  await page.locator('.company-card .edit-btn').first().click();
  await expect(page.locator('.update-card .update-status-badge')).toHaveText('Applied');
});

test('editing an update card updates its rendered values', async ({ page }) => {
  await seedAndOpenModal(page, [
    { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'first note' }
  ]);

  await page.locator('.update-card .update-card-actions button', { hasText: 'Edit' }).first().click();
  await page.fill('#update-card-role', 'Senior EM');
  await page.selectOption('#update-card-status', 'Interviewing');
  await page.fill('#update-card-notes', 'Phone screen booked');
  await page.click('#update-card-save-btn');

  const card = page.locator('.update-card').first();
  await expect(card).toContainText('Senior EM');
  await expect(card).toContainText('Phone screen booked');
  await expect(card.locator('.update-status-badge')).toHaveText('Interviewing');
});

test('long unbroken notes content wraps instead of overflowing horizontally (JST-68)', async ({ page }) => {
  // A single very long URL with no spaces — the kind of content that previously overflowed
  // the card horizontally instead of wrapping.
  const longUrl = 'https://careers.example.com/jobs/engineering-manager?ref=' + 'a'.repeat(200) + '&utm_source=referral';

  await seedAndOpenModal(page, [
    { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: longUrl }
  ]);

  // Read-only state: the rendered notes paragraph must wrap within its bounds, so its content
  // width (scrollWidth) should not exceed its visible width (clientWidth).
  const notes = page.locator('.update-card-notes').first();
  await expect(notes).toBeVisible();
  const overflows = await notes.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflows).toBe(false);

  // Both the read-only notes and the edit textarea should carry the wrap-breaking style.
  await expect(notes).toHaveCSS('overflow-wrap', 'break-word');

  // Edit state: the same long content in the textarea must also break rather than overflow.
  await page.locator('.update-card .update-card-actions button', { hasText: 'Edit' }).first().click();
  await expect(page.locator('#update-card-notes')).toHaveCSS('overflow-wrap', 'break-word');
});

test('deleting an update card removes it after confirmation', async ({ page }) => {
  await seedAndOpenModal(page, [
    { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'to be deleted' }
  ]);

  // The delete handler uses window.confirm — auto-accept it.
  page.on('dialog', (dialog) => dialog.accept());

  await expect(page.locator('.update-card')).toHaveCount(1);
  await page.locator('.update-card .update-card-actions button', { hasText: 'Delete' }).first().click();

  // The card is gone and the empty state returns.
  await expect(page.locator('.update-card')).toHaveCount(0);
  await expect(page.locator('.update-cards-empty')).toBeVisible();
});
