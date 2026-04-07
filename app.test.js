// Jest test suite for app.js
// We import only the pure logic functions that don't touch the DOM or external APIs.
// These are the functions worth unit testing because they have clear inputs and outputs.
// Define a mock API_CONFIG so app.js doesn't warn about missing config during tests
global.API_CONFIG = {
  ADZUNA_APP_ID: 'test_id',
  ADZUNA_APP_KEY: 'test_key'
};

const { getTracker, getSeen, getCompanies, updateStatus, updateNote, isFeatureEnabled, getDefaultTab, FEATURES } = require('./app');

// beforeEach runs before every single test in this file.
// Jest runs in Node.js which has no browser APIs — localStorage doesn't exist by default.
// We create a fake localStorage that behaves like the real one but stores data in a 
// plain JavaScript object called 'store'. This is called a "mock".
// We reset it before each test so tests don't affect each other.
beforeEach(() => {
  // 'store' is a plain object that acts as our in-memory storage for each test
  let store = {};

  // We assign a fake localStorage to 'global' (Node's equivalent of 'window')
  // It has the same three methods the real localStorage has: getItem, setItem, removeItem
  global.localStorage = {
    // getItem returns the value for a key, or null if it doesn't exist
    getItem: (key) => store[key] || null,
    // setItem stores a value under a key
    setItem: (key, val) => { store[key] = val; },
    // removeItem deletes a key from the store
    removeItem: (key) => { delete store[key]; }
  };
});

// describe() groups related tests together under a label.
// Each describe block covers one function from app.js.

describe('getTracker', () => {
  // test() defines a single test case.
  // The first argument is a plain English description of what we're testing.
  // The second argument is the function that runs the test.

  test('returns empty object when nothing stored', () => {
    // localStorage is empty (reset by beforeEach), so getTracker() should return {}
    // expect() is how we assert what we expect the result to be.
    // toEqual() does a deep comparison — checks the contents, not just the reference.
    expect(getTracker()).toEqual({});
  });

  test('returns parsed tracker from localStorage', () => {
    // Manually put something into our fake localStorage before calling the function.
    // We JSON.stringify because localStorage only stores strings, just like the real one.
    localStorage.setItem('jst_tracker_v1', JSON.stringify({ abc: { id: 'abc', title: 'Test Role' } }));
    
    // Now getTracker() should find and parse what we just stored.
    expect(getTracker()).toEqual({ abc: { id: 'abc', title: 'Test Role' } });
  });
});

describe('getSeen', () => {
  test('returns empty array when nothing stored', () => {
    // localStorage is empty, so getSeen() should return an empty array []
    expect(getSeen()).toEqual([]);
  });

  test('returns parsed array from localStorage', () => {
    // Put a fake list of seen job IDs into localStorage
    localStorage.setItem('jst_seen_v1', JSON.stringify(['id1', 'id2']));
    
    // getSeen() should find and return that array
    expect(getSeen()).toEqual(['id1', 'id2']);
  });
});

describe('getCompanies', () => {
  test('returns default companies on first load', () => {
    // When localStorage is empty, getCompanies() should return the DEFAULT_COMPANIES array
    // that's hardcoded in app.js as the seed data.
    const companies = getCompanies();

    // Array.isArray() checks it's actually an array, not null or an object
    expect(Array.isArray(companies)).toBe(true);

    // toBeGreaterThan(0) confirms there's at least one company in the default list
    expect(companies.length).toBeGreaterThan(0);
  });

  test('returns stored companies from localStorage', () => {
    // Create a minimal fake company object
    const mock = [{ id: 'test', name: 'Test Co', meta: 'Dublin', url: 'https://test.com', tags: [] }];
    
    // Store it in localStorage as if the user had previously saved it
    localStorage.setItem('jst_companies_v1', JSON.stringify(mock));
    
    // getCompanies() should return our mock data instead of the defaults
    expect(getCompanies()).toEqual(mock);
  });
});

describe('updateStatus', () => {
  test('updates status of a tracked role', () => {
    // Set up a tracker with one role that has status 'new'
    const tracker = { abc: { id: 'abc', title: 'Test Role', status: 'new', note: '' } };
    localStorage.setItem('jst_tracker_v1', JSON.stringify(tracker));

    // Call updateStatus to change it to 'applied'
    updateStatus('abc', 'applied');

    // Read the tracker back from localStorage and check the status changed
    // We use getTracker() to read it back rather than checking localStorage directly,
    // because that's also testing that saveTracker() worked correctly.
    expect(getTracker()['abc'].status).toBe('applied');
  });
});

describe('updateNote', () => {
  test('updates note on a tracked role', () => {
    // Set up a tracker with one role that has an empty note
    const tracker = { abc: { id: 'abc', title: 'Test Role', status: 'new', note: '' } };
    localStorage.setItem('jst_tracker_v1', JSON.stringify(tracker));

    // Call updateNote to add a note
    updateNote('abc', 'Looks promising');

    // Read back and confirm the note was saved
    expect(getTracker()['abc'].note).toBe('Looks promising');
  });
});

describe('isFeatureEnabled', () => {
  test('returns false for disabled jobs feature by default', () => {
    expect(isFeatureEnabled('jobs')).toBe(false);
  });

  test('returns true for enabled jobs feature when the flag is enabled', () => {
    const original = FEATURES.jobs;
    FEATURES.jobs = true;

    expect(isFeatureEnabled('jobs')).toBe(true);

    FEATURES.jobs = original;
  });

  test('returns false for unknown features', () => {
    expect(isFeatureEnabled('unknown')).toBe(false);
  });
});

describe('getDefaultTab', () => {
  test('returns companies when the companies feature is enabled', () => {
    // getDefaultTab is function-driven, not hardcoded in the DOM,
    // so this behavior can be asserted directly in the unit test.
    expect(getDefaultTab()).toBe('companies');
  });
});

// ─── Sort and filter tests ────────────────────────────────────────────────────
// sortCompanies(companies, sortKey) and filterCompanies(companies, { tag, daysAgo })
// are pure functions — they take an array and return a new sorted/filtered array.
// They never touch the DOM or localStorage, so they are ideal unit test targets.
//
// Company shape used in these tests (minimal — only fields the functions use):
//   { name: string, tags: string[], lastClicked: ISO string | null }
//
// lastClicked is the "last checked" field — it is set by trackCompanyClick() in
// app.js when the user clicks a company's careers link.

const { sortCompanies, filterCompanies } = require('./app');

// ─── Shared fixtures ──────────────────────────────────────────────────────────
// Reused across multiple test cases to keep the data consistent and easy to reason about.

// A date far in the past — used as the "oldest" checked value
const OLD_DATE = '2024-01-01T00:00:00.000Z';
// A date more recent than OLD_DATE but not today
const RECENT_DATE = '2025-06-01T00:00:00.000Z';
// Today's date as an ISO string — used to test "checked today" exclusion in date filters
const TODAY = new Date().toISOString();

// Three companies covering the key data variations:
//   - Alpha: has tags, was checked long ago
//   - Beta:  has overlapping tags, checked more recently
//   - Gamma: no tags, never checked (lastClicked: null)
const ALPHA = { name: 'Alpha Corp',  tags: ['EM', 'Delivery'], lastClicked: OLD_DATE };
const BETA  = { name: 'Beta Ltd',    tags: ['em', 'Scrum'],    lastClicked: RECENT_DATE };
const GAMMA = { name: 'Gamma GmbH',  tags: [],                 lastClicked: null };

describe('sortCompanies', () => {

  // ── Alphabetical ────────────────────────────────────────────────────────────

  test('alphabetical ascending returns A→Z order', () => {
    // Input is intentionally out of order to confirm the sort changes it
    const result = sortCompanies([GAMMA, BETA, ALPHA], 'alpha-asc');
    expect(result.map(c => c.name)).toEqual(['Alpha Corp', 'Beta Ltd', 'Gamma GmbH']);
  });

  test('alphabetical descending returns Z→A order', () => {
    const result = sortCompanies([ALPHA, BETA, GAMMA], 'alpha-desc');
    expect(result.map(c => c.name)).toEqual(['Gamma GmbH', 'Beta Ltd', 'Alpha Corp']);
  });

  test('default sort (no sort key provided) returns alphabetical ascending', () => {
    // Calling sortCompanies without a second argument should behave like 'alpha-asc'.
    // This is the default state of the sort control in the UI.
    const result = sortCompanies([GAMMA, BETA, ALPHA]);
    expect(result.map(c => c.name)).toEqual(['Alpha Corp', 'Beta Ltd', 'Gamma GmbH']);
  });

  // ── By last checked date ────────────────────────────────────────────────────

  test('last checked ascending puts oldest first', () => {
    // OLD_DATE < RECENT_DATE, so Alpha (oldest) should come first.
    // Gamma (null) goes to the bottom in both date sort directions.
    const result = sortCompanies([GAMMA, BETA, ALPHA], 'date-asc');
    expect(result.map(c => c.name)).toEqual(['Alpha Corp', 'Beta Ltd', 'Gamma GmbH']);
  });

  test('last checked descending puts newest first', () => {
    // RECENT_DATE > OLD_DATE, so Beta (newest) should come first.
    // Gamma (null) still goes to the bottom even in descending order.
    const result = sortCompanies([ALPHA, BETA, GAMMA], 'date-desc');
    expect(result.map(c => c.name)).toEqual(['Beta Ltd', 'Alpha Corp', 'Gamma GmbH']);
  });

  test('null lastClicked goes to bottom in ascending date sort', () => {
    // Gamma has never been checked — it should sort after dated entries, not before.
    // "Never checked" is not the same as "checked earliest".
    const result = sortCompanies([GAMMA, ALPHA], 'date-asc');
    expect(result[result.length - 1].name).toBe('Gamma GmbH');
  });

  test('null lastClicked goes to bottom in descending date sort', () => {
    // Gamma should also sink to the bottom when sorting newest-first.
    // It has no date, so it cannot be placed above entries that have one.
    const result = sortCompanies([GAMMA, ALPHA], 'date-desc');
    expect(result[result.length - 1].name).toBe('Gamma GmbH');
  });

  test('does not mutate the original array', () => {
    // sortCompanies must return a new array — mutating the input would cause
    // unexpected side effects in the UI (e.g. re-renders showing wrong order).
    const input = [GAMMA, BETA, ALPHA];
    sortCompanies(input, 'alpha-asc');
    expect(input.map(c => c.name)).toEqual(['Gamma GmbH', 'Beta Ltd', 'Alpha Corp']);
  });
});

describe('filterCompanies', () => {

  // ── By tag ──────────────────────────────────────────────────────────────────

  test('filter by tag returns only companies that have the tag', () => {
    // Only Alpha and Beta have 'EM' (or 'em') — Gamma has no tags at all
    const result = filterCompanies([ALPHA, BETA, GAMMA], { tag: 'EM' });
    expect(result.map(c => c.name)).toEqual(['Alpha Corp', 'Beta Ltd']);
  });

  test('tag filter is case-insensitive', () => {
    // 'em' on Beta should match a filter for 'EM', and vice versa.
    // Tags entered by different users may have inconsistent casing.
    const resultUpper = filterCompanies([ALPHA, BETA, GAMMA], { tag: 'EM' });
    const resultLower = filterCompanies([ALPHA, BETA, GAMMA], { tag: 'em' });
    expect(resultUpper.map(c => c.name)).toEqual(resultLower.map(c => c.name));
  });

  test('filter that matches no companies returns an empty array', () => {
    // 'Nonexistent' is not a tag on any fixture — result must be [] not an error
    const result = filterCompanies([ALPHA, BETA, GAMMA], { tag: 'Nonexistent' });
    expect(result).toEqual([]);
  });

  // ── By last checked date ────────────────────────────────────────────────────

  test('filter by date returns companies not checked within the last N days', () => {
    // With a 7-day window: Alpha (checked Jan 2024) and Gamma (never) should be included.
    // Beta was checked on RECENT_DATE — we need to check if that's within 7 days.
    // RECENT_DATE is 2025-06-01 which is well outside 7 days of today (2026-04-07),
    // so all three should be included in a 7-day staleness filter.
    const result = filterCompanies([ALPHA, BETA, GAMMA], { daysAgo: 7 });
    expect(result.map(c => c.name)).toEqual(['Alpha Corp', 'Beta Ltd', 'Gamma GmbH']);
  });

  test('a company checked today is excluded from a 7-day staleness filter', () => {
    // TODAY is within the last 7 days, so this company should NOT appear in results.
    // The filter shows companies that NEED checking — recently checked ones are up to date.
    const checkedToday = { name: 'Fresh Co', tags: [], lastClicked: TODAY };
    const result = filterCompanies([checkedToday, GAMMA], { daysAgo: 7 });
    expect(result.map(c => c.name)).not.toContain('Fresh Co');
  });

  test('a company with null lastClicked is included in date filters', () => {
    // Gamma has never been checked — it is the most stale possible entry and
    // should always appear when filtering for companies that need checking.
    const checkedToday = { name: 'Fresh Co', tags: [], lastClicked: TODAY };
    const result = filterCompanies([checkedToday, GAMMA], { daysAgo: 7 });
    expect(result.map(c => c.name)).toContain('Gamma GmbH');
  });

  // ── No filter applied ───────────────────────────────────────────────────────

  test('calling filterCompanies with no filters returns all companies unchanged', () => {
    // If neither tag nor daysAgo is provided, the full list should come back as-is.
    const result = filterCompanies([ALPHA, BETA, GAMMA], {});
    expect(result).toHaveLength(3);
  });

  // ── Combined filter + sort ──────────────────────────────────────────────────

  test('combined tag filter and sort returns correctly filtered and ordered results', () => {
    // Filter for 'EM' tag (Alpha has 'EM', Beta has 'em' — matched case-insensitively),
    // then sort alphabetically descending. In Z→A order: Beta before Alpha.
    // Gamma has no tags so it is excluded by the filter.
    // This confirms the intended usage: filterCompanies first, then sortCompanies.
    const filtered = filterCompanies([ALPHA, BETA, GAMMA], { tag: 'EM' });
    const sorted   = sortCompanies(filtered, 'alpha-desc');
    expect(sorted.map(c => c.name)).toEqual(['Beta Ltd', 'Alpha Corp']);
  });
});