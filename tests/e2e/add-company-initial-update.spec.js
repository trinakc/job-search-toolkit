// Playwright tests for adding an initial update card when creating a company (JST-72).
//
// These cover the Add Company modal's optional, collapsed "+ Add update" section: its
// toggle behaviour, keyboard accessibility, and that a new company is saved with (or
// without) one pre-populated update card depending on what the user does. The create-or-not
// rule itself is unit-tested via buildInitialUpdates in app.test.js.
//
// Each test starts from an empty companies store so the assertions don't depend on the
// DEFAULT_COMPANIES list, then drives the modal exactly as a user would.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// Opens the app with no stored companies and opens the Add Company modal.
async function openAddModal(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.setItem('jst_companies_v1', JSON.stringify([])));
  await page.reload();
  await page.click('button.add-company-btn');
  await expect(page.locator('#add-company-modal')).toBeVisible();
}

// Fills the required company fields with a given name.
async function fillCompany(page, name) {
  await page.fill('#company-name', name);
  await page.fill('#company-url', `https://${name.toLowerCase().replace(/\s+/g, '-')}.example.com/careers`);
}

// Reopens a saved company's edit modal so we can inspect its rendered update cards.
async function reopenEditModal(page, name) {
  await page.locator('.company-card', { hasText: name }).locator('.edit-btn').first().click();
  await expect(page.locator('#add-company-modal')).toBeVisible();
}

test('the initial-update section is collapsed by default with a visible toggle', async ({ page }) => {
  await openAddModal(page);

  // The toggle is visible; the fields stay hidden until the user expands them.
  await expect(page.locator('#initial-update-toggle')).toBeVisible();
  await expect(page.locator('#initial-update-fields')).toBeHidden();
  await expect(page.locator('#initial-update-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('clicking the toggle reveals focusable update fields', async ({ page }) => {
  await openAddModal(page);
  await page.click('#initial-update-toggle');

  await expect(page.locator('#initial-update-fields')).toBeVisible();
  await expect(page.locator('#initial-update-toggle')).toHaveAttribute('aria-expanded', 'true');
  // Role is focused on expand, and every field is reachable/fillable.
  await expect(page.locator('#initial-update-role')).toBeFocused();
  await expect(page.locator('#initial-update-status')).toBeVisible();
  await expect(page.locator('#initial-update-date')).toBeVisible();
  await expect(page.locator('#initial-update-notes')).toBeVisible();
});

test('the toggle is keyboard accessible', async ({ page }) => {
  await openAddModal(page);

  // Focus the toggle and activate it with the keyboard (Enter) — no mouse.
  await page.locator('#initial-update-toggle').focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#initial-update-fields')).toBeVisible();
  await expect(page.locator('#initial-update-toggle')).toHaveAttribute('aria-expanded', 'true');
});

test('saving with the section collapsed creates a company with no update cards', async ({ page }) => {
  await openAddModal(page);
  await fillCompany(page, 'Collapsed Co');
  await page.click('#modal-submit-btn');

  await expect(page.locator('#add-company-modal')).not.toBeVisible();
  await expect(page.locator('.company-card', { hasText: 'Collapsed Co' })).toBeVisible();

  // Reopen via edit: the company has no updates, so the empty state shows.
  await reopenEditModal(page, 'Collapsed Co');
  await expect(page.locator('#update-cards-section .update-cards-empty')).toBeVisible();
  await expect(page.locator('#update-cards-list .update-card')).toHaveCount(0);
});

test('saving with the section expanded and filled creates one pre-populated update card', async ({ page }) => {
  await openAddModal(page);
  await fillCompany(page, 'Filled Co');

  await page.click('#initial-update-toggle');
  await page.fill('#initial-update-role', 'Engineering Manager');
  await page.selectOption('#initial-update-status', 'Applied');
  await page.fill('#initial-update-date', '2026-06-10');
  await page.fill('#initial-update-notes', 'Applied via referral');
  await page.click('#modal-submit-btn');

  await expect(page.locator('#add-company-modal')).not.toBeVisible();
  await expect(page.locator('.company-card', { hasText: 'Filled Co' })).toBeVisible();

  // Reopen via edit: exactly one card with the entered values is rendered.
  await reopenEditModal(page, 'Filled Co');
  const card = page.locator('#update-cards-list .update-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Engineering Manager');
  await expect(card).toContainText('Applied via referral');
  await expect(card.locator('.update-status-badge')).toHaveText('Applied');
});

test('saving with the section expanded but no status creates no update card', async ({ page }) => {
  await openAddModal(page);
  await fillCompany(page, 'Blank Co');

  // Expand and type notes, but leave the status on its blank option.
  await page.click('#initial-update-toggle');
  await page.fill('#initial-update-notes', 'typed but no status chosen');
  await page.click('#modal-submit-btn');

  await expect(page.locator('#add-company-modal')).not.toBeVisible();

  // No card was created — status is the minimum and was never selected.
  await reopenEditModal(page, 'Blank Co');
  await expect(page.locator('#update-cards-section .update-cards-empty')).toBeVisible();
  await expect(page.locator('#update-cards-list .update-card')).toHaveCount(0);
});
