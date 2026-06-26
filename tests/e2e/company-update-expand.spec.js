// Playwright tests for the company-card update count + expand/collapse (JST-81).
//
// A company summary card normally shows only its most recent update's status. When a company
// has more than one update card, a "+ N more" indicator and an expand toggle appear; expanding
// shows every update card inline (read-only) without opening the modal. Single-update companies
// are unaffected. The pure count/ordering logic is unit-tested in app.test.js; these tests cover
// the rendered UI and the toggle interaction (including keyboard).

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

test('a company with a single update card shows no count indicator or toggle', async ({ page }) => {
  await seedAndLoad(page, [
    company('Solo Ltd', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }
    ])
  ]);

  const solo = card(page, 'Solo Ltd');
  await expect(solo.locator('.company-status')).toHaveText('Applied');
  await expect(solo.locator('.company-update-toggle')).toHaveCount(0);
});

test('a company with three update cards shows the latest status and a "+ 2 more" toggle', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  // Collapsed: most recent status badge plus the count toggle.
  await expect(acme.locator('.company-status')).toHaveText('Interviewing');
  const toggle = acme.locator('.company-update-toggle');
  await expect(toggle).toHaveText('+ 2 more');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // Not expanded yet — no inline list.
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

test('collapsing returns the card to showing only the most recent update', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', THREE_UPDATES)]);

  const acme = card(page, 'Acme Corp');
  const toggle = acme.locator('.company-update-toggle');

  await toggle.click(); // expand
  await expect(acme.locator('.company-update-card')).toHaveCount(3);

  await acme.locator('.company-update-toggle').click(); // collapse
  await expect(acme.locator('.company-updates-expanded')).toHaveCount(0);
  await expect(acme.locator('.company-status')).toHaveText('Interviewing');
  await expect(acme.locator('.company-update-toggle')).toHaveText('+ 2 more');
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
