// Playwright tests for the Activity summary generator (JST-66).
//
// These cover the UI behaviour Jest can't: navigating to the panel, generating a summary
// from seeded data, the empty-state message, and the copy-to-clipboard button. The pure
// date-range filtering and Markdown formatting are unit-tested in app.test.js.
//
// Each test seeds its own companies into localStorage before the page loads, so the tests
// are self-contained and independent of the DEFAULT_COMPANIES list.

const { test, expect } = require('@playwright/test');

const APP_URL = '/job-search-toolkit.html';

// Grant clipboard access for the whole file so the copy test can read it back.
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

// Builds a company with the given name and update cards, matching the real model shape.
function makeCompany(name, updates) {
  return {
    name,
    location: 'Dublin',
    url: `https://${name.toLowerCase().replace(/\s+/g, '')}.example.com`,
    tags: [],
    roleApplied: '',
    lastClicked: null,
    lastUpdated: null,
    updates
  };
}

// Seeds companies into localStorage, reloads, and opens the Activity summary panel.
async function seedAndOpen(page, companies) {
  await page.goto(APP_URL);
  await page.evaluate((data) => {
    localStorage.setItem('jst_companies_v1', JSON.stringify(data));
  }, companies);
  await page.reload();
  await page.locator('nav button', { hasText: 'Activity summary' }).click();
  await expect(page.locator('#summary')).toBeVisible();
}

// Fills the From/To date range. Dates are YYYY-MM-DD, matching the native date inputs.
async function setRange(page, start, end) {
  await page.fill('#summary-start', start);
  await page.fill('#summary-end', end);
}

test('the Activity summary nav button and panel are available', async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.locator('nav button', { hasText: 'Activity summary' })).toBeVisible();
});

test('generating a summary shows update cards grouped by company', async ({ page }) => {
  await seedAndOpen(page, [
    makeCompany('Acme Corp', [
      { role: 'Engineering Manager', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'Applied via referral' }
    ]),
    makeCompany('Globex', [
      { role: 'Product Manager', status: 'Interviewing', date: '2026-06-12T00:00:00.000Z', notes: 'Phone screen booked' }
    ])
  ]);

  await setRange(page, '2026-06-01', '2026-06-30');
  await page.click('#summary-generate-btn');

  const output = page.locator('#summary-output');
  await expect(output).toBeVisible();
  // Both companies appear as Markdown headings with their card's status, role, and notes.
  await expect(output).toContainText('## Acme Corp');
  await expect(output).toContainText('Engineering Manager');
  await expect(output).toContainText('Applied via referral');
  await expect(output).toContainText('## Globex');
  await expect(output).toContainText('Interviewing');
});

test('a range with no activity shows a clear empty-state message', async ({ page }) => {
  await seedAndOpen(page, [
    makeCompany('Acme Corp', [
      { role: 'EM', status: 'Applied', date: '2026-01-01T00:00:00.000Z', notes: 'out of range' }
    ])
  ]);

  await setRange(page, '2026-06-01', '2026-06-30');
  await page.click('#summary-generate-btn');

  const output = page.locator('#summary-output');
  await expect(output).toBeVisible();
  await expect(output).toContainText('No activity');
});

test('the Copy button copies the summary and shows confirmation', async ({ page }) => {
  await seedAndOpen(page, [
    makeCompany('Acme Corp', [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'note one' }
    ])
  ]);

  await setRange(page, '2026-06-01', '2026-06-30');
  await page.click('#summary-generate-btn');

  const copyBtn = page.locator('#summary-copy-btn');
  await copyBtn.click();

  // The button flips to a confirmation state...
  await expect(copyBtn).toHaveText('Copied!');
  await expect(copyBtn).toHaveClass(/copied/);

  // ...and the clipboard holds the generated summary.
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('## Acme Corp');
  expect(clipboard).toContain('note one');
});
