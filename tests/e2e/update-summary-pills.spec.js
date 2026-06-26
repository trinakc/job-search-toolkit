// Playwright tests for the company-card update summary pills (JST-83).
//
// Every company card with at least one update card shows a compact "{role} {status}" pill per
// update (newest first) as an at-a-glance summary, plus a "See all updates" toggle that expands
// the full detail cards inline. The previously-shown derived status badge is gone for cards with
// updates (it duplicated the pills). Companies with no update cards keep the neutral "No updates"
// state. This ticket also adds a "Careers page" label above the careers link.

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

// Returns the company-card locator for a named company.
function card(page, name) {
  return page.locator('.company-card', { hasText: name });
}

test('a single-update card shows one "{role} {status}" summary pill and a See all updates toggle', async ({ page }) => {
  await seedAndLoad(page, [
    company('Acme Corp', [
      { role: 'Staff Engineer', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'note' }
    ])
  ]);

  const acme = card(page, 'Acme Corp');
  const pills = acme.locator('.company-update-summary');
  await expect(pills).toHaveCount(1);
  // Pill reads "{role} {status}" with the status lowercased to read as a phrase.
  await expect(pills.first()).toHaveText('Staff Engineer applied');
  // The toggle is present even for a single update, so the detail (date/notes) is reachable inline.
  await expect(acme.locator('.company-update-toggle')).toHaveText('See all updates');
  // The duplicated derived status badge is gone for cards with updates.
  await expect(acme.locator('.company-status')).toHaveCount(0);
});

test('a multi-update card shows one pill per update, newest first, with no derived badge', async ({ page }) => {
  await seedAndLoad(page, [
    company('Beta Ltd', [
      { role: 'Staff Officer', status: 'Applied', date: '2026-05-01T00:00:00.000Z', notes: '' },
      { role: 'Assistant Principal Officer', status: 'Applied', date: '2026-05-13T00:00:00.000Z', notes: '' }
    ])
  ]);

  const beta = card(page, 'Beta Ltd');
  const pills = beta.locator('.company-update-summary');
  await expect(pills).toHaveCount(2);
  // Newest first: the 13 May card precedes the 1 May card.
  await expect(pills.nth(0)).toHaveText('Assistant Principal Officer applied');
  await expect(pills.nth(1)).toHaveText('Staff Officer applied');
  await expect(beta.locator('.company-status')).toHaveCount(0);
  await expect(beta.locator('.company-update-toggle')).toHaveText('See all updates');
});

test('See all updates expands the pills into full detail cards and back', async ({ page }) => {
  await seedAndLoad(page, [
    company('Beta Ltd', [
      { role: 'Staff Officer', status: 'Applied', date: '2026-05-01T00:00:00.000Z', notes: 'Online form' },
      { role: 'Assistant Principal Officer', status: 'Interviewing', date: '2026-05-13T00:00:00.000Z', notes: 'Phone screen' }
    ])
  ]);

  const beta = card(page, 'Beta Ltd');
  const toggle = beta.locator('.company-update-toggle');

  await toggle.click();
  // Expanded: pills are replaced by the full detail cards (with notes), newest first.
  await expect(beta.locator('.company-update-summary')).toHaveCount(0);
  const detail = beta.locator('.company-update-card');
  await expect(detail).toHaveCount(2);
  await expect(detail.nth(0)).toContainText('Phone screen');
  await expect(toggle).toHaveText('Show less');

  // Collapsing returns to the pill summaries.
  await toggle.click();
  await expect(beta.locator('.company-update-card')).toHaveCount(0);
  await expect(beta.locator('.company-update-summary')).toHaveCount(2);
});

test('a company with no update cards shows no pills, only the "No updates" badge', async ({ page }) => {
  await seedAndLoad(page, [company('Gamma Inc', [])]);

  const gamma = card(page, 'Gamma Inc');
  await expect(gamma.locator('.company-update-summary')).toHaveCount(0);
  await expect(gamma.locator('.company-update-toggle')).toHaveCount(0);
  await expect(gamma.locator('.company-status')).toHaveText('No updates');
});

test('a pill with a blank role falls back to showing the status alone', async ({ page }) => {
  await seedAndLoad(page, [
    company('Delta Co', [
      { role: '', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }
    ])
  ]);

  await expect(card(page, 'Delta Co').locator('.company-update-summary')).toHaveText('Applied');
});

test('every company card shows a "Careers page" label above the careers link', async ({ page }) => {
  await seedAndLoad(page, [company('Acme Corp', [])]);

  const acme = card(page, 'Acme Corp');
  await expect(acme.locator('.careers-label')).toHaveText('Careers page');
  await expect(acme.locator('.careers-link')).toBeVisible();
});
