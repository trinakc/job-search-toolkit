// Jest test suite for app.js
// We import only the pure logic functions that don't touch the DOM or external APIs.
// These are the functions worth unit testing because they have clear inputs and outputs.
// Define a mock API_CONFIG so app.js doesn't warn about missing config during tests.
// We include a test Reed API key here so fetchReedJobs tests can override it per-test.
global.API_CONFIG = {
  REED_API_KEY: 'test-reed-api-key'  // Placeholder — individual tests override this as needed
};

const { getTracker, getSeen, getCompanies, updateStatus, updateNote, isFeatureEnabled, getDefaultTab, FEATURES, fetchReedJobs, getSearchTitles } = require('./app');

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
  // FEATURES.jobs is now true — Reed API integration enabled live job search
  test('returns true for jobs feature now that Reed API is enabled', () => {
    expect(isFeatureEnabled('jobs')).toBe(true);
  });

  test('returns false for unknown features', () => {
    expect(isFeatureEnabled('unknown')).toBe(false);
  });

  test('returns true for companies feature', () => {
    expect(isFeatureEnabled('companies')).toBe(true);
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

// ─── fetchReedJobs tests ──────────────────────────────────────────────────────
// fetchReedJobs(keywords, locationName) is the pure data-fetching layer for the
// Reed.co.uk API. It takes search parameters, builds an authenticated HTTP request,
// and returns the results array from the Reed API response.
//
// These tests mock global.fetch so no real network calls are made — the tests run
// fast, offline, and deterministically regardless of Reed API availability.
//
// Reed API docs: https://www.reed.co.uk/developers/jobseeker
// Auth: HTTP Basic Auth — API key as username, empty string as password

describe('fetchReedJobs', () => {
  // Save and restore global.fetch around each test so mocks don't leak
  let originalFetch;

  beforeEach(() => {
    // Capture the real fetch (if present) so we can restore it after each test
    originalFetch = global.fetch;

    // Ensure API_CONFIG has a test Reed key before every test.
    // Individual tests can override REED_API_KEY to test edge cases.
    global.API_CONFIG = { REED_API_KEY: 'test-reed-api-key' };
  });

  afterEach(() => {
    // Always restore fetch so other test suites start clean
    global.fetch = originalFetch;
  });

  // ── Test 1: Successful response ─────────────────────────────────────────────
  // The core happy path: API returns results, function returns them to the caller.
  // Confirms that fetchReedJobs correctly unwraps the 'results' property from the
  // Reed API JSON envelope.
  test('successful response returns the results array from the Reed API', async () => {
    // Define the shape of data Reed would return for a real search
    const mockResults = [
      { jobId: 101, jobTitle: 'Delivery Manager', employerName: 'Test Corp', locationName: 'Dublin' }
    ];

    // Replace global.fetch with a Jest spy that immediately resolves with mock data.
    // This simulates a successful 200 OK response from Reed without hitting the network.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,                                           // HTTP 200 OK
      json: () => Promise.resolve({ results: mockResults })  // Reed response envelope
    });

    const results = await fetchReedJobs('delivery manager', 'Ireland');

    // The function should unwrap and return the array — not the envelope object
    expect(results).toEqual(mockResults);
  });

  // ── Test 2: Correct proxy endpoint URL ──────────────────────────────────────
  // Verifies the function calls the LOCAL PROXY path rather than Reed directly.
  //
  // WHY /api/reed/search and not https://www.reed.co.uk/...?
  // Reed's API does not send CORS headers, so browsers block direct calls to it.
  // fetchReedJobs() calls the same-origin proxy endpoint (/api/reed/search) instead.
  // server.js receives the request and forwards it server-side to Reed — no CORS issue.
  test('API call uses the local proxy endpoint (not Reed directly)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    });

    await fetchReedJobs('delivery manager', 'Ireland');

    // First argument to fetch() is the URL — extract it from the mock call record
    const calledUrl = global.fetch.mock.calls[0][0];

    // Must call the local proxy, not Reed directly — direct calls would be CORS-blocked
    expect(calledUrl).toContain('/api/reed/search');

    // Must NOT call Reed directly from the browser
    expect(calledUrl).not.toContain('www.reed.co.uk');
  });

  // ── Test 3: Phrase-quoted keywords ───────────────────────────────────────────
  // Verifies that keywords are wrapped in double-quotes in the request URL so
  // Reed treats them as an exact phrase rather than individual OR-matched terms.
  //
  // Without quotes, "engineering manager" returns any job mentioning "engineering"
  // OR "manager" anywhere in the title or description — a huge irrelevant result set.
  // With quotes, only jobs containing the exact phrase are returned.
  //
  // URLSearchParams.get() decodes %22 back to " so we can assert the raw value.
  test('keywords are phrase-quoted in the request URL for exact-match search', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    });

    await fetchReedJobs('engineering manager', 'Dublin');

    const calledUrl = global.fetch.mock.calls[0][0];

    // The URL is a relative path — supply a dummy base so URLSearchParams can parse it.
    const parsedUrl = new URL(calledUrl, 'http://localhost:8000');

    // Keywords must be wrapped in quotes: '"engineering manager"' not 'engineering manager'
    expect(parsedUrl.searchParams.get('keywords')).toBe('"engineering manager"');
    // locationName is passed unchanged — no quoting applied
    expect(parsedUrl.searchParams.get('locationName')).toBe('Dublin');
  });

  // ── Test 3b: Single-keyword phrase quoting ────────────────────────────────────
  // Quoting applies to ALL keywords, including single words. This ensures consistent
  // exact-match behaviour and guards against regression where the fix is only applied
  // to multi-word terms.
  test('single-word keywords are also phrase-quoted for consistent exact-match behaviour', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    });

    await fetchReedJobs('manager', 'Ireland');

    const calledUrl = global.fetch.mock.calls[0][0];
    const parsedUrl = new URL(calledUrl, 'http://localhost:8000');

    // Even a single word must be wrapped: '"manager"' not 'manager'
    expect(parsedUrl.searchParams.get('keywords')).toBe('"manager"');
  });

  // ── Test 4: HTTP Basic Auth header ──────────────────────────────────────────
  // Verifies the Authorization header is constructed correctly.
  // Reed requires: Authorization: Basic <base64(apiKey + ':')>
  // The colon separator is required by the HTTP Basic Auth spec (RFC 7617) —
  // it separates username from password (password is empty for Reed).
  test('authentication uses HTTP Basic Auth with the API key as username and empty password', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    });

    await fetchReedJobs('delivery manager', 'Ireland');

    // Second argument to fetch() is the options object (headers, method, etc.)
    const calledOptions = global.fetch.mock.calls[0][1];

    // Compute the expected Base64 value: btoa('test-reed-api-key:')
    // The colon with no password after it matches Reed's auth requirement
    const expectedCredentials = btoa('test-reed-api-key:');
    expect(calledOptions.headers['Authorization']).toBe('Basic ' + expectedCredentials);
  });

  // ── Test 5: Missing API key ──────────────────────────────────────────────────
  // Verifies graceful handling when REED_API_KEY is absent or empty.
  // Without a key, Reed returns 401 — but we fail early before making any
  // network request, which is faster and gives a clearer error message.
  test('missing or empty API key throws an error and does not call fetch', async () => {
    // Override the key to empty — simulates a user who hasn't added their key yet
    global.API_CONFIG.REED_API_KEY = '';

    // Install a spy so we can assert fetch was NOT called
    global.fetch = jest.fn();

    // The function should throw — callers (fetchJobs UI function) catch this and
    // show a user-facing error message rather than letting an unhandled rejection bubble up
    await expect(fetchReedJobs('delivery manager', 'Ireland')).rejects.toThrow();

    // No network call should have been made — fail before reaching the fetch line
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── Test 6: API error response ───────────────────────────────────────────────
  // Verifies that a non-200 response from Reed is surfaced as a thrown error.
  // Without this guard, the function would try to call .json() on an error response,
  // return undefined results, and the UI would silently show zero jobs.
  test('non-200 API response throws an error so the caller can show a user-facing message', async () => {
    // Simulate a 401 Unauthorized (what Reed returns if the key is invalid)
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,    // response.ok is false for any status outside 200-299
      status: 401,
      statusText: 'Unauthorized'
    });

    // The function must throw — the UI fetchJobs() function catches this and
    // renders an error message to the user instead of an empty job list
    await expect(fetchReedJobs('delivery manager', 'Ireland')).rejects.toThrow();
  });
});

// ─── getSearchTitles tests ────────────────────────────────────────────────────
// getSearchTitles() reads the job title list from API_CONFIG.SEARCH_TITLES and
// returns it for use by fetchAllJobs() in "Search all titles" mode.
//
// Moving titles to config allows each user to personalise the search without
// editing app.js. These tests verify the config is read correctly and that
// missing or empty config is handled gracefully rather than silently firing
// zero API requests.

describe('getSearchTitles', () => {
  let warnSpy;

  beforeEach(() => {
    // Reset to a base config without SEARCH_TITLES before each test.
    // Individual tests add SEARCH_TITLES as needed to control what the function sees.
    global.API_CONFIG = { REED_API_KEY: 'test-reed-api-key' };

    // Silence console.warn output during tests — we assert it was called, not its text.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ── Test 1: Reads titles from config ─────────────────────────────────────────
  // The core behaviour: when SEARCH_TITLES is present, the function returns it
  // unchanged so fetchAllJobs() uses exactly the titles the user configured.
  test('returns the SEARCH_TITLES array from API_CONFIG when configured', () => {
    global.API_CONFIG.SEARCH_TITLES = ['delivery manager', 'engineering manager', 'scrum master'];

    const titles = getSearchTitles();

    expect(titles).toEqual(['delivery manager', 'engineering manager', 'scrum master']);
  });

  // ── Test 2: Missing SEARCH_TITLES ────────────────────────────────────────────
  // If the user has not added SEARCH_TITLES to config.js, the function must not
  // throw or return undefined — fetchAllJobs() checks for an empty array to decide
  // whether to show a user-facing error and return early.
  test('returns an empty array and logs a warning when SEARCH_TITLES is missing from config', () => {
    // SEARCH_TITLES is deliberately absent from global.API_CONFIG (set in beforeEach)
    const titles = getSearchTitles();

    expect(titles).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  // ── Test 3: Empty SEARCH_TITLES array ────────────────────────────────────────
  // An empty array in config is treated the same as missing — it would cause
  // fetchAllJobs() to fire zero requests and show nothing, so we catch it here
  // and warn rather than proceeding silently.
  test('returns an empty array and logs a warning when SEARCH_TITLES is an empty array', () => {
    global.API_CONFIG.SEARCH_TITLES = [];

    const titles = getSearchTitles();

    expect(titles).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});