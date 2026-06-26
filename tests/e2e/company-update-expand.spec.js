// Playwright tests for the company-card update expand/collapse (JST-81, redesigned in JST-83).
//
// Every company card with updates shows a compact "{role} {status}" summary pill per update and a
// "See all updates" toggle; expanding swaps the pills for the full update cards inline (read-only)
// without opening the modal, and the toggle becomes "Show less". The pure count/ordering logic is
// unit-tested in app.test.js; these tests cover the rendered UI and the toggle interaction
// (including keyboard).

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// Builds a company with the given updates array (other fields are unused by these tests).
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

// Returns the card locator for a named company.
function card(page, name) {
  return page.locator('.company-card', { hasText: name });
}

// A company with three update cards, deliberately stored out of date order.
const THREE_UPDATES = [
  { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'applied note' },
  { role: 'EM', status: 'Interviewing', date: '2026-06-14T00:00:00.000Z', notes: 'phone screen' },
  { role: 'EM', status: 'Considering', date: '2026-06-08T00:00:00.000Z', notes: 'spotted role' }
];

test('a single-update card also shows a See all updates toggle (JST-83)', async ({ page }) => {
  await seedAndLoad(page, [
    company('Solo Ltd', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }
    ])
  ]);

  const solo = card(page, 'Solo Ltd');
  // One summary pill, and the toggle is present even with a single update so the detail is reachable.
  await expect(solo.locator('.company-update-summary')).toHaveCount(1);
  await expect(solo.locator('.company-update-toggle')).toHaveText('See all updates');
});

test('a company with three update cards shows three summary pills and a See all updates toggle', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  // Collapsed: one pill per update (no derived status badge) plus the toggle.
  await expect(acme.locator('.company-update-summary')).toHaveCount(3);
  await expect(acme.locator('.company-status')).toHaveCount(0);
  const toggle = acme.locator('.company-update-toggle');
  await expect(toggle).toHaveText('See all updates');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // Not expanded yet — no inline detail list.
  await expect(acme.locator('.company-updates-expanded')).toHaveCount(0);
});

test('clicking the toggle expands all update cards inline without opening the modal', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  await acme.locator('.company-update-toggle').click();

  // All three cards visible inline, newest first.
  const inlineCards = acme.locator('.company-update-card');
  await expect(inlineCards).toHaveCount(3);
  await expect(inlineCards.nth(0)).toContainText('Interviewing');
  await expect(inlineCards.nth(1)).toContainText('Applied');
  await expect(inlineCards.nth(2)).toContainText('Considering');

  // Toggle now reflects the expanded state and the modal stayed closed.
  const toggle = acme.locator('.company-update-toggle');
  await expect(toggle).toHaveText('Show less');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#add-company-modal')).toBeHidden();
});

test('collapsing returns the card to the summary pills', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  const toggle = acme.locator('.company-update-toggle');

  await toggle.click(); // expand
  await expect(acme.locator('.company-update-card')).toHaveCount(3);

  await acme.locator('.company-update-toggle').click(); // collapse
  await expect(acme.locator('.company-updates-expanded')).toHaveCount(0);
  await expect(acme.locator('.company-update-summary')).toHaveCount(3);
  await expect(acme.locator('.company-update-toggle')).toHaveText('See all updates');
});

test('the toggle is keyboard operable', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  const toggle = acme.locator('.company-update-toggle');

  // Focus the toggle and activate it with the keyboard.
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(acme.locator('.company-update-card')).toHaveCount(3);
  await expect(acme.locator('.company-update-toggle')).toHaveAttribute('aria-expanded', 'true');
});
