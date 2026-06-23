// Jest test suite for app.js
// We import only the pure logic functions that don't touch the DOM or external APIs.
// These are the functions worth unit testing because they have clear inputs and outputs.
// Define a mock API_CONFIG so app.js doesn't warn about missing config during tests.
// We include a test Reed API key here so fetchReedJobs tests can override it per-test.
global.API_CONFIG = {
  REED_API_KEY: 'test-reed-api-key'  // Placeholder — individual tests override this as needed
};

const { getTracker, getSeen, getCompanies, removeCompany, updateStatus, updateNote, isFeatureEnabled, getDefaultTab, FEATURES, fetchReedJobs, getSearchTitles, getSearchTitleCount, parseCSVToCompanies, parseJSONToCompanies, companiesToCSV, companiesToJSON, mergeImportedCompanies, UPDATE_STATUSES, isValidUpdateStatus, createUpdateCard, validateUpdateCard, normalizeCompany, addUpdateCard, editUpdateCard, deleteUpdateCard, escapeHtml, getLatestUpdateCard, deriveCompanyStatus, migrateCompanies, runCompanyMigration, filterUpdatesInRange, buildActivitySummary, buildInitialUpdates } = require('./app');

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

describe('removeCompany', () => {
  // removeCompany deletes a company by name and then re-renders the grid via renderCompanies(),
  // which lives in app-dom.js and is not loaded in the Jest (no-DOM) environment. We stub it so
  // these tests exercise the pure state/localStorage deletion logic in isolation. The inline
  // confirmation flow (JST-75) is DOM behaviour and is covered by Playwright, not here.
  beforeEach(() => {
    global.renderCompanies = () => {};
    // DEFAULT_COMPANIES is set empty so getCompanies() never seeds config defaults over our fixture.
    global.API_CONFIG = { REED_API_KEY: 'test-reed-api-key', DEFAULT_COMPANIES: [] };
    // Under jsdom the shared localStorage mock isn't truly reset between tests, so clear the
    // companies key explicitly for a clean start (same defensive pattern used in getCompanies tests).
    localStorage.removeItem('jst_companies_v1');
  });

  // Clear the companies key after each test so the data we save here doesn't leak into later
  // describes (e.g. getCompanies) that assume an empty company list.
  afterEach(() => {
    localStorage.removeItem('jst_companies_v1');
  });

  test('removes the named company from localStorage and leaves the others intact', () => {
    const stored = [
      { name: 'Alpha Corp', location: 'Dublin', url: 'https://alpha.com', tags: [], updates: [] },
      { name: 'Beta Ltd', location: 'Cork', url: 'https://beta.com', tags: [], updates: [] }
    ];
    localStorage.setItem('jst_companies_v1', JSON.stringify(stored));

    removeCompany('Alpha Corp');

    // Only the company matching the passed name should be gone; the rest persist.
    expect(getCompanies().map(c => c.name)).toEqual(['Beta Ltd']);
  });

  test('leaves all companies intact when the name matches none', () => {
    const stored = [
      { name: 'Alpha Corp', location: 'Dublin', url: 'https://alpha.com', tags: [], updates: [] }
    ];
    localStorage.setItem('jst_companies_v1', JSON.stringify(stored));

    removeCompany('Nonexistent Co');

    expect(getCompanies().map(c => c.name)).toEqual(['Alpha Corp']);
  });
});

describe('getCompanies', () => {
  // A minimal company fixture — used to verify getCompanies() seeds from config correctly.
  // Kept small so tests are readable; the real shape is the same as DEFAULT_COMPANIES in config.js.
  const TEST_COMPANIES = [
    // updates: [] is part of the company shape since JST-62. getCompanies() normalizes every
    // company on read, so the value returned always carries an updates array.
    { name: 'Test Corp', location: 'Dublin · Test SaaS', url: 'https://testcorp.com/careers', tags: ['EM'], lastClicked: null, status: null, usefulInfo: '', lastUpdated: null, updates: [] }
  ];

  beforeEach(() => {
    // Supply DEFAULT_COMPANIES via config so getCompanies() can seed localStorage on first load.
    // The outer beforeEach resets localStorage; this ensures config is also in a known state.
    global.API_CONFIG = { REED_API_KEY: 'test-reed-api-key', DEFAULT_COMPANIES: TEST_COMPANIES };
  });

  // ── Test 1: Seeds from config on first load ───────────────────────────────────
  // When localStorage is empty, getCompanies() should fall back to API_CONFIG.DEFAULT_COMPANIES
  // and seed localStorage with it so the user sees their configured companies on first load.
  test('returns companies from API_CONFIG.DEFAULT_COMPANIES when localStorage is empty', () => {
    // localStorage is empty (reset by outer beforeEach); config has TEST_COMPANIES
    const companies = getCompanies();

    expect(companies).toEqual(TEST_COMPANIES);
  });

  // ── Test 2: Returns stored data when present ──────────────────────────────────
  // Once the user has saved companies, getCompanies() must return their data, not the config defaults.
  // This is the normal operating path after first load.
  test('returns stored companies from localStorage and ignores config defaults', () => {
    // Pre-populate localStorage as if the user had previously saved their own list.
    // Note this fixture predates JST-62 and has no updates field — getCompanies() must
    // default it to [] on read without mutating the rest of the object.
    const stored = [{ id: 'test', name: 'Stored Co', location: 'Cork', url: 'https://stored.com', tags: [] }];
    localStorage.setItem('jst_companies_v1', JSON.stringify(stored));

    // getCompanies() should return the stored data (with updates defaulted), not TEST_COMPANIES from config
    expect(getCompanies()).toEqual([{ ...stored[0], updates: [] }]);
  });

  // ── Test 3: Graceful fallback when config is missing ─────────────────────────
  // If a user hasn't added DEFAULT_COMPANIES to config.js, getCompanies() must not crash.
  // It returns [] and warns so the empty state in the UI is shown cleanly.
  test('returns an empty array and logs a warning when DEFAULT_COMPANIES is missing from config', () => {
    // Explicitly clear any companies data — makes this test self-contained regardless of
    // what previous tests wrote to localStorage.
    localStorage.removeItem('jst_companies_v1');

    // Override config to remove DEFAULT_COMPANIES — simulates a user who hasn't configured it
    global.API_CONFIG = { REED_API_KEY: 'test-reed-api-key' };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const companies = getCompanies();

    expect(companies).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── Update card data model (JST-62) ──────────────────────────────────────────
// An update card records one role's status at a point in time. Each company holds
// an `updates` array of these cards. This ticket adds the model only — no UI.
// The status enum here is deliberately distinct from the legacy lowercase company
// `status` field; the two coexist until JST-65 migrates the old field away.

describe('UPDATE_STATUSES', () => {
  test('lists exactly the six allowed update statuses in order', () => {
    // These are the canonical status values an update card may take. Order is asserted
    // because the UI (JST-63) will render them as dropdown options in this sequence.
    expect(UPDATE_STATUSES).toEqual(['Considering', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn']);
  });
});

describe('isValidUpdateStatus', () => {
  test('returns true for every allowed status value', () => {
    UPDATE_STATUSES.forEach(status => {
      expect(isValidUpdateStatus(status)).toBe(true);
    });
  });

  test('returns false for an unrecognised status string', () => {
    expect(isValidUpdateStatus('Ghosted')).toBe(false);
  });

  test('returns false for the legacy lowercase company status values', () => {
    // The old company-level status field uses lowercase values; those are NOT valid
    // update-card statuses, so the two models never get accidentally conflated.
    expect(isValidUpdateStatus('applied')).toBe(false);
    expect(isValidUpdateStatus('interviewing')).toBe(false);
  });

  test('returns false for null and undefined', () => {
    expect(isValidUpdateStatus(null)).toBe(false);
    expect(isValidUpdateStatus(undefined)).toBe(false);
  });
});

describe('createUpdateCard', () => {
  test('builds a complete card from full input, preserving every field', () => {
    const card = createUpdateCard({
      role: 'Engineering Manager',
      status: 'Applied',
      date: '2026-06-10T00:00:00.000Z',
      notes: 'Applied via referral'
    });
    expect(card).toEqual({
      role: 'Engineering Manager',
      status: 'Applied',
      date: '2026-06-10T00:00:00.000Z',
      notes: 'Applied via referral'
    });
  });

  test('defaults role and notes to empty strings when omitted', () => {
    const card = createUpdateCard({ status: 'Considering', date: '2026-06-10T00:00:00.000Z' });
    expect(card.role).toBe('');
    expect(card.notes).toBe('');
  });

  test('supplies a valid ISO date when date is omitted', () => {
    const card = createUpdateCard({ status: 'Considering' });
    // The generated date should round-trip through Date without becoming Invalid Date.
    expect(typeof card.date).toBe('string');
    expect(Number.isNaN(Date.parse(card.date))).toBe(false);
  });

  test('throws when the status is not in the allowed enum', () => {
    expect(() => createUpdateCard({ status: 'Ghosted' })).toThrow();
  });

  test('throws when status is missing entirely', () => {
    expect(() => createUpdateCard({ role: 'EM' })).toThrow();
  });
});

// buildInitialUpdates decides whether a company created via the Add Company modal's optional
// initial-update section starts with one pre-populated update card (JST-72). The rule: a card
// is created only when the section is expanded AND a status is chosen. Collapsed, or expanded
// with no status, yields an empty updates array — no blank card is ever created.
describe('buildInitialUpdates', () => {
  test('returns an empty array when the section is collapsed, even if a status is set', () => {
    // A status picked then collapsed must not produce a card — collapsed means "no update".
    const updates = buildInitialUpdates({ expanded: false, role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'x' });
    expect(updates).toEqual([]);
  });

  test('returns an empty array when expanded but no status is selected', () => {
    // The blank status option ('') is the minimum-not-met case: no card despite other fields.
    const updates = buildInitialUpdates({ expanded: true, role: 'EM', status: '', date: '2026-06-10T00:00:00.000Z', notes: 'typed but no status' });
    expect(updates).toEqual([]);
  });

  test('returns one card with defaulted role/notes and a valid date when only a status is given', () => {
    const updates = buildInitialUpdates({ expanded: true, status: 'Considering' });
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('Considering');
    expect(updates[0].role).toBe('');
    expect(updates[0].notes).toBe('');
    expect(Number.isNaN(Date.parse(updates[0].date))).toBe(false);
  });

  test('returns one card preserving every field when expanded and fully filled in', () => {
    const updates = buildInitialUpdates({
      expanded: true,
      role: 'Engineering Manager',
      status: 'Applied',
      date: '2026-06-10T00:00:00.000Z',
      notes: 'Applied via referral'
    });
    expect(updates).toEqual([{
      role: 'Engineering Manager',
      status: 'Applied',
      date: '2026-06-10T00:00:00.000Z',
      notes: 'Applied via referral'
    }]);
  });
});

describe('validateUpdateCard', () => {
  test('reports a fully valid card as valid with no errors', () => {
    const result = validateUpdateCard({
      role: 'EM',
      status: 'Interviewing',
      date: '2026-06-10T00:00:00.000Z',
      notes: 'Round 2 scheduled'
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('flags a card whose status is not in the enum', () => {
    const result = validateUpdateCard({ role: 'EM', status: 'Ghosted', date: '2026-06-10T00:00:00.000Z', notes: '' });
    expect(result.valid).toBe(false);
    // The error message should mention status so the caller knows which field failed.
    expect(result.errors.some(e => /status/i.test(e))).toBe(true);
  });

  test('flags non-string role and notes and an empty date', () => {
    const result = validateUpdateCard({ role: 42, status: 'Applied', date: '', notes: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /role/i.test(e))).toBe(true);
    expect(result.errors.some(e => /date/i.test(e))).toBe(true);
    expect(result.errors.some(e => /notes/i.test(e))).toBe(true);
  });
});

describe('normalizeCompany', () => {
  test('adds an empty updates array when the field is absent', () => {
    const company = { name: 'Acme', url: 'https://acme.com', tags: [] };
    expect(normalizeCompany(company).updates).toEqual([]);
  });

  test('preserves an existing updates array unchanged', () => {
    const updates = [{ role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }];
    const company = { name: 'Acme', url: 'https://acme.com', tags: [], updates };
    expect(normalizeCompany(company).updates).toEqual(updates);
  });

  test('coerces a non-array updates value to an empty array', () => {
    const company = { name: 'Acme', url: 'https://acme.com', tags: [], updates: 'oops' };
    expect(normalizeCompany(company).updates).toEqual([]);
  });

  test('leaves all other company fields unchanged', () => {
    const company = { name: 'Acme', url: 'https://acme.com', tags: ['EM'], status: 'applied', usefulInfo: 'note' };
    const normalized = normalizeCompany(company);
    expect(normalized.name).toBe('Acme');
    expect(normalized.url).toBe('https://acme.com');
    expect(normalized.tags).toEqual(['EM']);
    // Legacy fields must survive untouched — JST-65 handles their removal, not this ticket.
    expect(normalized.status).toBe('applied');
    expect(normalized.usefulInfo).toBe('note');
  });
});

// ─── Update card CRUD (JST-63) ─────────────────────────────────────────────────
// addUpdateCard / editUpdateCard / deleteUpdateCard mutate a single company's `updates`
// array and persist via saveCompanies. Each returns a result object ({ ok, updates } on
// success, { ok: false, errors } on failure) so the modal UI can surface inline errors.
// They locate the company by its index in the full array — the same index the modal's
// edit handlers already use.

// Seeds one company (with an empty updates array) into mock localStorage and returns it.
// Mirrors how the app persists companies so getCompanies() reads them back normalized.
function seedOneCompany() {
  const company = { name: 'Acme', location: 'Dublin', url: 'https://acme.com/careers', tags: ['EM'], lastClicked: null, status: null, usefulInfo: '', lastUpdated: null, updates: [] };
  localStorage.setItem('jst_companies_v1', JSON.stringify([company]));
  return company;
}

describe('addUpdateCard', () => {
  test('adds a valid card to the company and persists it', () => {
    seedOneCompany();
    const result = addUpdateCard(0, { role: 'Engineering Manager', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'Applied via referral' });

    expect(result.ok).toBe(true);
    const stored = getCompanies()[0].updates;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ role: 'Engineering Manager', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'Applied via referral' });
  });

  test('defaults role, notes, and date via createUpdateCard when omitted', () => {
    seedOneCompany();
    const result = addUpdateCard(0, { status: 'Considering' });

    expect(result.ok).toBe(true);
    const card = getCompanies()[0].updates[0];
    expect(card.role).toBe('');
    expect(card.notes).toBe('');
    // date defaults to a parseable ISO string when not supplied
    expect(Number.isNaN(Date.parse(card.date))).toBe(false);
  });

  test('rejects an invalid status without mutating the company', () => {
    seedOneCompany();
    const result = addUpdateCard(0, { status: 'Ghosted' });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(getCompanies()[0].updates).toHaveLength(0);
  });

  test('returns ok:false when the company index does not exist', () => {
    seedOneCompany();
    const result = addUpdateCard(99, { status: 'Applied' });

    expect(result.ok).toBe(false);
  });
});

describe('editUpdateCard', () => {
  test('replaces the card at the given index and persists', () => {
    seedOneCompany();
    addUpdateCard(0, { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'first' });

    const result = editUpdateCard(0, 0, { role: 'Senior EM', status: 'Interviewing', date: '2026-06-12T00:00:00.000Z', notes: 'phone screen' });

    expect(result.ok).toBe(true);
    const card = getCompanies()[0].updates[0];
    expect(card.role).toBe('Senior EM');
    expect(card.status).toBe('Interviewing');
    expect(card.notes).toBe('phone screen');
  });

  test('rejects an out-of-range card index', () => {
    seedOneCompany();
    const result = editUpdateCard(0, 5, { status: 'Applied' });

    expect(result.ok).toBe(false);
  });

  test('rejects an invalid status and leaves the existing card unchanged', () => {
    seedOneCompany();
    addUpdateCard(0, { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'keep me' });

    const result = editUpdateCard(0, 0, { status: 'Ghosted' });

    expect(result.ok).toBe(false);
    expect(getCompanies()[0].updates[0].status).toBe('Applied');
    expect(getCompanies()[0].updates[0].notes).toBe('keep me');
  });
});

describe('deleteUpdateCard', () => {
  test('removes the card at the given index and persists', () => {
    seedOneCompany();
    addUpdateCard(0, { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'a' });
    addUpdateCard(0, { role: 'PM', status: 'Considering', date: '2026-06-11T00:00:00.000Z', notes: 'b' });

    const result = deleteUpdateCard(0, 0);

    expect(result.ok).toBe(true);
    const updates = getCompanies()[0].updates;
    expect(updates).toHaveLength(1);
    expect(updates[0].role).toBe('PM');
  });

  test('is a guarded no-op for an out-of-range index', () => {
    seedOneCompany();
    addUpdateCard(0, { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'a' });

    const result = deleteUpdateCard(0, 9);

    expect(result.ok).toBe(false);
    expect(getCompanies()[0].updates).toHaveLength(1);
  });
});

describe('escapeHtml', () => {
  test('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });

  test('returns an empty string for null or undefined', () => {
    // Card fields can be empty; the helper must not emit "null"/"undefined" into the DOM.
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

// ─── Derived company status (JST-64) ───────────────────────────────────────────
// The company's displayed status is derived from its most recent update card, replacing
// the legacy company.status field. getLatestUpdateCard finds that card; deriveCompanyStatus
// returns its status (or null when there are no updates, signalling a neutral empty state).

describe('getLatestUpdateCard', () => {
  test('returns null when the company has no update cards', () => {
    expect(getLatestUpdateCard({ name: 'Acme', updates: [] })).toBeNull();
  });

  test('returns null when updates is missing entirely', () => {
    expect(getLatestUpdateCard({ name: 'Acme' })).toBeNull();
  });

  test('returns the card with the most recent date, regardless of array order', () => {
    const company = { name: 'Acme', updates: [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Interviewing', date: '2026-06-14T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Considering', date: '2026-06-08T00:00:00.000Z', notes: '' }
    ] };
    expect(getLatestUpdateCard(company).status).toBe('Interviewing');
  });

  test('prefers the later-added card when two share the most recent date', () => {
    // Same date on two cards: the one added later (higher index) is treated as current.
    const company = { name: 'Acme', updates: [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'first' },
      { role: 'EM', status: 'Offer', date: '2026-06-10T00:00:00.000Z', notes: 'second' }
    ] };
    expect(getLatestUpdateCard(company).notes).toBe('second');
    expect(getLatestUpdateCard(company).status).toBe('Offer');
  });
});

describe('deriveCompanyStatus', () => {
  test('returns null when there are no update cards', () => {
    expect(deriveCompanyStatus({ name: 'Acme', updates: [] })).toBeNull();
  });

  test('returns the status of the most recent update card', () => {
    const company = { name: 'Acme', updates: [
      { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Rejected', date: '2026-06-15T00:00:00.000Z', notes: '' }
    ] };
    expect(deriveCompanyStatus(company)).toBe('Rejected');
  });

  test('reflects the newest date even when cards are out of chronological order', () => {
    const company = { name: 'Acme', updates: [
      { role: 'EM', status: 'Offer', date: '2026-06-20T00:00:00.000Z', notes: '' },
      { role: 'EM', status: 'Interviewing', date: '2026-06-12T00:00:00.000Z', notes: '' }
    ] };
    expect(deriveCompanyStatus(company)).toBe('Offer');
  });
});

// ─── Legacy data migration (JST-65) ────────────────────────────────────────────
// migrateCompanies folds each company's legacy usefulInfo + status into a single update
// card and removes both legacy fields. It runs once on load (runCompanyMigration) and is
// idempotent — detection keys on the presence of the legacy fields, which it deletes.

describe('migrateCompanies', () => {
  test('folds usefulInfo + legacy status into one update card and removes the old fields', () => {
    const input = [{ name: 'Acme', url: 'https://acme.com', tags: [], status: 'applied', usefulInfo: 'Great team', updates: [] }];
    const { companies, changed } = migrateCompanies(input);
    const c = companies[0];

    expect(changed).toBe(true);
    expect(c.updates).toHaveLength(1);
    expect(c.updates[0].role).toBe('');
    expect(c.updates[0].status).toBe('Applied');
    expect(c.updates[0].notes).toBe('Great team');
    expect(Number.isNaN(Date.parse(c.updates[0].date))).toBe(false);
    // Both legacy fields are gone entirely (not just nulled).
    expect('usefulInfo' in c).toBe(false);
    expect('status' in c).toBe(false);
  });

  test('removes the legacy fields without creating a card when both are blank', () => {
    const input = [{ name: 'Acme', url: 'https://acme.com', tags: [], status: null, usefulInfo: '', updates: [] }];
    const { companies, changed } = migrateCompanies(input);

    expect(changed).toBe(true);
    expect(companies[0].updates).toHaveLength(0);
    expect('usefulInfo' in companies[0]).toBe(false);
    expect('status' in companies[0]).toBe(false);
  });

  test('maps each legacy status value to the capitalised enum, blank to Considering', () => {
    const cases = [
      ['applied', 'Applied'],
      ['interviewing', 'Interviewing'],
      ['rejected', 'Rejected'],
      ['offer', 'Offer'],
      [null, 'Considering'],
      ['', 'Considering'],
      ['something-odd', 'Considering']
    ];
    cases.forEach(([legacy, expected]) => {
      // usefulInfo present so a card is always created, isolating the status mapping.
      const { companies } = migrateCompanies([{ name: 'X', url: 'u', tags: [], status: legacy, usefulInfo: 'note', updates: [] }]);
      expect(companies[0].updates[0].status).toBe(expected);
    });
  });

  test('appends to existing update cards rather than replacing them', () => {
    const existing = { role: 'EM', status: 'Interviewing', date: '2026-06-01T00:00:00.000Z', notes: 'prior' };
    const input = [{ name: 'Acme', url: 'https://acme.com', tags: [], status: 'offer', usefulInfo: 'migrated', updates: [existing] }];
    const { companies } = migrateCompanies(input);

    expect(companies[0].updates).toHaveLength(2);
    expect(companies[0].updates[0]).toEqual(existing);
    expect(companies[0].updates[1].status).toBe('Offer');
  });

  test('is idempotent — a second pass adds no further cards and reports no change', () => {
    const input = [{ name: 'Acme', url: 'https://acme.com', tags: [], status: 'applied', usefulInfo: 'note', updates: [] }];
    const first = migrateCompanies(input);
    const second = migrateCompanies(first.companies);

    expect(second.changed).toBe(false);
    expect(second.companies[0].updates).toHaveLength(1);
  });

  test('leaves an already-migrated company (no legacy keys) untouched', () => {
    const input = [{ name: 'Acme', url: 'https://acme.com', tags: [], updates: [{ role: '', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'x' }] }];
    const { companies, changed } = migrateCompanies(input);

    expect(changed).toBe(false);
    expect(companies[0].updates).toHaveLength(1);
  });
});

describe('runCompanyMigration', () => {
  test('migrates companies in localStorage and persists the result', () => {
    const seeded = [{ name: 'Acme', location: 'Dublin', url: 'https://acme.com', tags: ['EM'], lastClicked: null, status: 'interviewing', usefulInfo: 'Met the hiring manager', lastUpdated: null, updates: [] }];
    localStorage.setItem('jst_companies_v1', JSON.stringify(seeded));

    runCompanyMigration();

    const migrated = getCompanies()[0];
    expect('usefulInfo' in migrated).toBe(false);
    expect('status' in migrated).toBe(false);
    expect(migrated.updates).toHaveLength(1);
    expect(migrated.updates[0].status).toBe('Interviewing');
    expect(migrated.updates[0].notes).toBe('Met the hiring manager');
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

// ─── getSearchTitleCount tests ────────────────────────────────────────────────
// getSearchTitleCount() returns the number of titles in API_CONFIG.SEARCH_TITLES.
// Used by the mode toggle UI to display "N titles from config" in all-titles mode,
// and to disable that mode option gracefully when no titles are configured.

describe('getSearchTitleCount', () => {
  // ── Test 1: Returns count when titles are configured ─────────────────────────
  // The core use case: user has SEARCH_TITLES in config, UI shows the correct count.
  test('returns the number of titles in API_CONFIG.SEARCH_TITLES when configured', () => {
    global.API_CONFIG = { REED_API_KEY: 'test', SEARCH_TITLES: ['delivery manager', 'engineering manager', 'scrum master'] };

    expect(getSearchTitleCount()).toBe(3);
  });

  // ── Test 2: Returns 0 when SEARCH_TITLES is missing ──────────────────────────
  // If the user has not added SEARCH_TITLES to config, the count should be 0 rather
  // than throwing — the UI uses 0 to show a warning state on the toggle option.
  test('returns 0 when SEARCH_TITLES is missing from API_CONFIG', () => {
    global.API_CONFIG = { REED_API_KEY: 'test' };

    expect(getSearchTitleCount()).toBe(0);
  });

  // ── Test 3: Returns 0 when API_CONFIG is not defined ─────────────────────────
  // Guards against the CI/fresh-setup case where config.js has not been created yet.
  test('returns 0 when API_CONFIG is not defined', () => {
    const original = global.API_CONFIG;
    global.API_CONFIG = undefined;

    expect(getSearchTitleCount()).toBe(0);

    global.API_CONFIG = original;
  });
});

// ─── parseCSVToCompanies tests ────────────────────────────────────────────────
// parseCSVToCompanies() parses a CSV string into company objects.
// Required fields are name and url — rows missing either are skipped.
// Tags are pipe-delimited in the CSV ("EM|DevOps") and split back into an array.

describe('parseCSVToCompanies', () => {
  // ── Test 1: Happy path ───────────────────────────────────────────────────────
  // Verifies that a well-formed CSV row produces a correctly shaped company object.
  test('parses a valid CSV and returns the correct company objects', () => {
    const csv = 'name,location,url,tags,status,usefulInfo,lastClicked,lastUpdated\nDatadog,Dublin,https://careers.datadoghq.com,EM|DevOps,applied,Great team,,';

    const result = parseCSVToCompanies(csv);

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].name).toBe('Datadog');
    expect(result.imported[0].location).toBe('Dublin');
    expect(result.imported[0].url).toBe('https://careers.datadoghq.com');
    expect(result.imported[0].status).toBe('applied');
    expect(result.skipped).toHaveLength(0);
  });

  // ── Test 2: Tags are array ───────────────────────────────────────────────────
  // Tags stored as "EM|IC|DevOps" in CSV must be split back into an array.
  test('splits pipe-separated tags into an array', () => {
    const csv = 'name,url,tags\nAcme,https://acme.com,EM|IC|DevOps';

    const result = parseCSVToCompanies(csv);

    expect(result.imported[0].tags).toEqual(['EM', 'IC', 'DevOps']);
  });

  // ── Test 3: Missing name ─────────────────────────────────────────────────────
  // Rows without a name cannot be identified or rendered — they must be skipped.
  test('skips rows missing the required name field and counts them in skipped', () => {
    const csv = 'name,url\n,https://acme.com\nAcme,https://acme.com';

    const result = parseCSVToCompanies(csv);

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/name/i);
  });

  // ── Test 4: Missing url ──────────────────────────────────────────────────────
  // A company without a URL can't link anywhere — it must be skipped.
  test('skips rows missing the required url field and counts them in skipped', () => {
    const csv = 'name,url\nAcme,';

    const result = parseCSVToCompanies(csv);

    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/url/i);
  });

  // ── Test 5: Header-only CSV ──────────────────────────────────────────────────
  // An exported file with no data rows should not fail — it just imports nothing.
  test('returns an empty imported array for a header-only CSV', () => {
    const csv = 'name,location,url,tags';

    const result = parseCSVToCompanies(csv);

    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  // ── Test 6: Quoted fields with commas ───────────────────────────────────────
  // Location strings like "Dublin, Ireland" must be preserved intact.
  test('handles quoted fields that contain commas', () => {
    const csv = 'name,location,url\nAcme,"Dublin, Ireland",https://acme.com';

    const result = parseCSVToCompanies(csv);

    expect(result.imported[0].location).toBe('Dublin, Ireland');
  });
});

// ─── parseJSONToCompanies tests ───────────────────────────────────────────────
// parseJSONToCompanies() parses a JSON array string into company objects.
// Returns an error property for invalid JSON or non-array input.

describe('parseJSONToCompanies', () => {
  // ── Test 1: Happy path ───────────────────────────────────────────────────────
  test('parses a valid JSON array and returns company objects', () => {
    const json = JSON.stringify([{ name: 'Acme', url: 'https://acme.com', location: 'Dublin', tags: ['EM'] }]);

    const result = parseJSONToCompanies(json);

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].name).toBe('Acme');
    expect(result.skipped).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  // ── Test 2: Missing name ─────────────────────────────────────────────────────
  test('skips entries missing the name field', () => {
    const json = JSON.stringify([{ url: 'https://acme.com' }, { name: 'Valid', url: 'https://valid.com' }]);

    const result = parseJSONToCompanies(json);

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/name/i);
  });

  // ── Test 3: Missing url ──────────────────────────────────────────────────────
  test('skips entries missing the url field', () => {
    const json = JSON.stringify([{ name: 'Acme' }]);

    const result = parseJSONToCompanies(json);

    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/url/i);
  });

  // ── Test 4: Invalid JSON ─────────────────────────────────────────────────────
  // Malformed text should produce a clear error rather than crashing.
  test('returns an error result for invalid JSON', () => {
    const result = parseJSONToCompanies('not valid json {{{');

    expect(result.error).toBeDefined();
    expect(result.imported).toHaveLength(0);
  });

  // ── Test 5: Non-array JSON ───────────────────────────────────────────────────
  // The import format must be an array — a plain object is not valid.
  test('returns an error result when given a JSON value that is not an array', () => {
    const result = parseJSONToCompanies(JSON.stringify({ name: 'not an array' }));

    expect(result.error).toBeDefined();
    expect(result.imported).toHaveLength(0);
  });
});

// ─── companiesToCSV tests ─────────────────────────────────────────────────────
// companiesToCSV() serializes a company array to a CSV string.
// Tags become pipe-delimited; fields with commas are quoted.

describe('companiesToCSV', () => {
  // ── Test 1: Header row ───────────────────────────────────────────────────────
  test('includes a header row with all expected column names', () => {
    const csv = companiesToCSV([]);
    const header = csv.split('\n')[0];

    expect(header).toContain('name');
    expect(header).toContain('url');
    expect(header).toContain('tags');
  });

  // ── Test 1b: Legacy roleApplied column is gone (JST-67) ──────────────────────
  // The company-level "Role applied for" field was removed; role now lives only on
  // update cards. The export header must no longer advertise a roleApplied column.
  test('does not include the removed roleApplied column', () => {
    const header = companiesToCSV([]).split('\n')[0];

    expect(header).not.toContain('roleApplied');
  });

  // ── Test 2: Tags serialization ───────────────────────────────────────────────
  // Tags must use pipe (|) not comma — commas are the CSV delimiter.
  test('serializes tags array as pipe-separated values', () => {
    const companies = [{ name: 'Acme', url: 'https://acme.com', tags: ['EM', 'DevOps'] }];

    const csv = companiesToCSV(companies);

    expect(csv).toContain('EM|DevOps');
  });

  // ── Test 3: Quoting ──────────────────────────────────────────────────────────
  // Fields containing commas must be double-quoted to remain parseable.
  test('wraps fields containing commas in double-quotes', () => {
    const companies = [{ name: 'Acme', url: 'https://acme.com', location: 'Dublin, Ireland', tags: [] }];

    const csv = companiesToCSV(companies);

    expect(csv).toContain('"Dublin, Ireland"');
  });
});

// ─── companiesToJSON tests ────────────────────────────────────────────────────
// companiesToJSON() serializes a company array to a pretty-printed JSON string.

describe('companiesToJSON', () => {
  // ── Test 1: Round-trip ───────────────────────────────────────────────────────
  test('returns a valid JSON string that parses back to the original array', () => {
    const companies = [{ name: 'Acme', url: 'https://acme.com', tags: ['EM'] }];

    const json = companiesToJSON(companies);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(companies);
  });
});

// ─── mergeImportedCompanies tests ────────────────────────────────────────────
// mergeImportedCompanies() merges parsed companies into the existing localStorage list.
// Deduplicates by name — existing companies are never overwritten.

describe('mergeImportedCompanies', () => {
  beforeEach(() => {
    // renderCompanies is defined in app-dom.js which is not loaded in Jest.
    // We stub it so the merge function can call it safely without throwing.
    global.renderCompanies = jest.fn();
  });

  afterEach(() => {
    delete global.renderCompanies;
  });

  // ── Test 1: Adds new companies ───────────────────────────────────────────────
  test('adds new companies that do not already exist in localStorage', () => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([{ name: 'Existing', url: 'https://existing.com', tags: [] }]));
    const parseResult = { imported: [{ name: 'New Co', url: 'https://new.com', tags: [] }], skipped: [] };

    const result = mergeImportedCompanies(parseResult);

    expect(result.added).toBe(1);
    const saved = JSON.parse(localStorage.getItem('jst_companies_v1'));
    expect(saved).toHaveLength(2);
  });

  // ── Test 2: Skips duplicates ─────────────────────────────────────────────────
  // Companies with the same name must not be overwritten — dedup by name.
  test('skips companies whose name matches an existing entry and counts them as duplicates', () => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([{ name: 'Existing', url: 'https://existing.com', tags: [] }]));
    const parseResult = { imported: [{ name: 'Existing', url: 'https://different.com', tags: [] }], skipped: [] };

    const result = mergeImportedCompanies(parseResult);

    expect(result.added).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  // ── Test 3: Correct counts ───────────────────────────────────────────────────
  test('returns correct added, duplicates, and skipped counts', () => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([{ name: 'Alpha', url: 'https://alpha.com', tags: [] }]));
    const parseResult = {
      imported: [
        { name: 'Alpha', url: 'https://alpha.com', tags: [] },  // duplicate
        { name: 'Beta', url: 'https://beta.com', tags: [] }      // new
      ],
      skipped: [{ row: 3, reason: 'missing required field: url' }]
    };

    const result = mergeImportedCompanies(parseResult);

    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.skipped).toBe(1);
  });

  // ── Test 4: Calls renderCompanies ────────────────────────────────────────────
  // The company grid must re-render after a merge so new cards appear immediately.
  test('calls renderCompanies after merging', () => {
    localStorage.setItem('jst_companies_v1', JSON.stringify([]));

    mergeImportedCompanies({ imported: [{ name: 'New', url: 'https://new.com', tags: [] }], skipped: [] });

    expect(global.renderCompanies).toHaveBeenCalled();
  });
});

// ─── Import/Export round-trip integrity tests ─────────────────────────────────
// Verifies that exporting and re-importing a company list preserves all data.

describe('import/export round-trip integrity', () => {
  const fixture = {
    name: 'Acme',
    location: 'Dublin, Ireland',
    url: 'https://acme.com',
    tags: ['EM', 'IC'],
    status: 'applied',
    usefulInfo: 'Great team',
    lastClicked: null,
    lastUpdated: null
  };

  // ── Test 1: CSV round-trip ───────────────────────────────────────────────────
  test('exporting to CSV and re-importing preserves name, tags, status, and location', () => {
    const csv = companiesToCSV([fixture]);
    const result = parseCSVToCompanies(csv);

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].name).toBe('Acme');
    // Location contains a comma so it requires quoting — verifies the parser handles it
    expect(result.imported[0].location).toBe('Dublin, Ireland');
    expect(result.imported[0].tags).toEqual(['EM', 'IC']);
    expect(result.imported[0].status).toBe('applied');
  });

  // ── Test 2: JSON round-trip ──────────────────────────────────────────────────
  test('exporting to JSON and re-importing yields the identical company array', () => {
    const json = companiesToJSON([fixture]);
    const result = parseJSONToCompanies(json);

    expect(result.imported).toEqual([fixture]);
  });
});

// ─── Activity summary generator (JST-66) ───────────────────────────────────────
// These cover the two pure functions behind the Activity summary panel: filtering
// update cards across all companies by an inclusive date range, and formatting the
// matches into a copyable Markdown summary grouped by company. The DOM panel, the
// Generate button, and copy-to-clipboard are covered by Playwright.

// Builds a company with the given name and update cards. Mirrors the real model
// shape: every company carries an `updates` array of { role, status, date, notes }.
function makeCompanyWithUpdates(name, updates) {
  return {
    name,
    location: '',
    url: `https://${name.toLowerCase().replace(/\s+/g, '')}.example.com`,
    tags: [],
    lastClicked: null,
    lastUpdated: null,
    updates
  };
}

describe('filterUpdatesInRange', () => {
  test('groups in-range update cards by company', () => {
    const companies = [
      makeCompanyWithUpdates('Acme', [
        { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'a' }
      ]),
      makeCompanyWithUpdates('Globex', [
        { role: '', status: 'Considering', date: '2026-06-11T00:00:00.000Z', notes: 'b' }
      ])
    ];

    const result = filterUpdatesInRange(companies, '2026-06-01', '2026-06-30');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Acme');
    expect(result[0].updates).toHaveLength(1);
    expect(result[1].name).toBe('Globex');
    expect(result[1].updates).toHaveLength(1);
  });

  test('excludes companies with no update cards in the range', () => {
    const companies = [
      makeCompanyWithUpdates('InRange', [
        { role: '', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: '' }
      ]),
      makeCompanyWithUpdates('OutOfRange', [
        { role: '', status: 'Applied', date: '2026-01-01T00:00:00.000Z', notes: '' }
      ]),
      makeCompanyWithUpdates('NoUpdates', [])
    ];

    const result = filterUpdatesInRange(companies, '2026-06-01', '2026-06-30');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('InRange');
  });

  test('range is inclusive of both the start and end day', () => {
    // Cards stored at UTC midnight; a card dated exactly on the start or end day must be included.
    const companies = [
      makeCompanyWithUpdates('Edges', [
        { role: '', status: 'Applied', date: '2026-06-01T00:00:00.000Z', notes: 'on start' },
        { role: '', status: 'Applied', date: '2026-06-30T00:00:00.000Z', notes: 'on end' }
      ])
    ];

    const result = filterUpdatesInRange(companies, '2026-06-01', '2026-06-30');

    expect(result).toHaveLength(1);
    expect(result[0].updates).toHaveLength(2);
  });

  test('excludes cards on the day before the start and the day after the end', () => {
    const companies = [
      makeCompanyWithUpdates('JustOutside', [
        { role: '', status: 'Applied', date: '2026-05-31T00:00:00.000Z', notes: 'day before' },
        { role: '', status: 'Applied', date: '2026-07-01T00:00:00.000Z', notes: 'day after' }
      ])
    ];

    const result = filterUpdatesInRange(companies, '2026-06-01', '2026-06-30');

    expect(result).toHaveLength(0);
  });

  test('sorts the cards within a company by date ascending', () => {
    const companies = [
      makeCompanyWithUpdates('Acme', [
        { role: '', status: 'Interviewing', date: '2026-06-20T00:00:00.000Z', notes: 'later' },
        { role: '', status: 'Applied', date: '2026-06-05T00:00:00.000Z', notes: 'earlier' }
      ])
    ];

    const result = filterUpdatesInRange(companies, '2026-06-01', '2026-06-30');

    expect(result[0].updates.map(c => c.notes)).toEqual(['earlier', 'later']);
  });
});

describe('buildActivitySummary', () => {
  test('produces a Markdown heading per company with status, role, date, and notes', () => {
    const companies = [
      makeCompanyWithUpdates('Acme Corp', [
        { role: 'Engineering Manager', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'Applied via referral' }
      ])
    ];

    const summary = buildActivitySummary(companies, '2026-06-01', '2026-06-30');

    expect(summary).toContain('## Acme Corp');
    expect(summary).toContain('Applied');
    expect(summary).toContain('Engineering Manager');
    expect(summary).toContain('Applied via referral');
    // Date formatted in UTC like the rest of the app (e.g. "10 Jun 2026").
    expect(summary).toContain('2026');
  });

  test('omits the role segment when the card has no role', () => {
    const companies = [
      makeCompanyWithUpdates('Globex', [
        { role: '', status: 'Considering', date: '2026-06-09T00:00:00.000Z', notes: '' }
      ])
    ];

    const summary = buildActivitySummary(companies, '2026-06-01', '2026-06-30');

    expect(summary).toContain('Considering');
    // No empty "— —" role separator should leak into the line.
    expect(summary).not.toMatch(/—\s+—/);
  });

  test('returns a clear empty-state message when no cards fall in the range', () => {
    const companies = [
      makeCompanyWithUpdates('Acme', [
        { role: '', status: 'Applied', date: '2026-01-01T00:00:00.000Z', notes: '' }
      ])
    ];

    const summary = buildActivitySummary(companies, '2026-06-01', '2026-06-30');

    // A non-empty, human-readable message — never a blank string.
    expect(summary.trim().length).toBeGreaterThan(0);
    expect(summary.toLowerCase()).toContain('no activity');
  });

  test('reads as a structured log spanning multiple companies', () => {
    const companies = [
      makeCompanyWithUpdates('Acme', [
        { role: 'EM', status: 'Applied', date: '2026-06-10T00:00:00.000Z', notes: 'one' }
      ]),
      makeCompanyWithUpdates('Globex', [
        { role: 'PM', status: 'Interviewing', date: '2026-06-12T00:00:00.000Z', notes: 'two' }
      ])
    ];

    const summary = buildActivitySummary(companies, '2026-06-01', '2026-06-30');

    expect(summary).toContain('## Acme');
    expect(summary).toContain('## Globex');
    expect(summary.indexOf('## Acme')).toBeLessThan(summary.indexOf('## Globex'));
  });
});