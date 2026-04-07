// Jest test suite for app.js
// We import only the pure logic functions that don't touch the DOM or external APIs.
// These are the functions worth unit testing because they have clear inputs and outputs.
// Define a mock API_CONFIG so app.js doesn't warn about missing config during tests
global.API_CONFIG = {
  ADZUNA_APP_ID: 'test_id',
  ADZUNA_APP_KEY: 'test_key'
};

const { getTracker, getSeen, getCompanies, updateStatus, updateNote, isFeatureEnabled } = require('./app');

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
  test('returns true for enabled features', () => {
    // Test that features set to true in FEATURES object return true
    expect(isFeatureEnabled('jobs')).toBe(true);
    expect(isFeatureEnabled('tracker')).toBe(true);
    expect(isFeatureEnabled('companies')).toBe(true);
  });

  test('returns false for disabled features', () => {
    // Test that features set to false in FEATURES object return false
    expect(isFeatureEnabled('alerts')).toBe(false);
    expect(isFeatureEnabled('scorer')).toBe(false);
  });

  test('returns false for unknown features', () => {
    // Test that features not defined in FEATURES object return false
    expect(isFeatureEnabled('unknown')).toBe(false);
  });
});