/* global API_CONFIG, renderCompanies, renderAlerts */
/* eslint-disable no-unused-vars */
// API credentials are loaded from config.js (git-ignored)
// If not available, show setup instructions
if (typeof API_CONFIG === 'undefined') {
  console.warn('API_CONFIG not loaded. Please copy config.template.js to config.js and add your API keys.');
}

// Feature flags for major panels/features
// Set to false to disable/hide features that are broken or non-functional
// This allows the app to gracefully handle incomplete features by hiding them
const FEATURES = {
  jobs: true,      // Live job search - enabled (powered by Reed.co.uk API)
  tracker: true,   // Job tracker - enabled now that live search is available
  companies: true, // Company tracker - working
  alerts: false,   // Google alerts - disabled due to hardcoded personal search strings
  scorer: false    // Job fit scorer - disabled due to hardcoded personal profile
};

// Function to check if a feature is enabled
// Returns false if the feature doesn't exist in FEATURES or is explicitly set to false
function isFeatureEnabled(feature) {
  return FEATURES.hasOwnProperty(feature) && FEATURES[feature] !== false; /* eslint-disable-line no-prototype-builtins */
}

// Function-driven default tab logic for the landing page.
// This keeps landing behavior in code instead of relying on hardcoded DOM state.
function getDefaultTab() {
  if (isFeatureEnabled('companies')) return 'companies';
  if (isFeatureEnabled('tracker')) return 'tracker';
  if (isFeatureEnabled('jobs')) return 'jobs';
  return Object.keys(FEATURES).find(isFeatureEnabled) || 'companies';
}

// Helper function to get configured locale for date/time formatting
function getLocale() {
  return (typeof API_CONFIG !== 'undefined' && API_CONFIG.LOCALE) ? API_CONFIG.LOCALE : 'en-US';
}

// ─── getSearchTitles ──────────────────────────────────────────────────────────
// Returns the list of job titles used by fetchAllJobs() in "Search all titles" mode.
// Reads from API_CONFIG.SEARCH_TITLES so each user can personalise their search
// in config.js without editing app.js.
//
// Returns [] and logs a warning if SEARCH_TITLES is missing or empty — fetchAllJobs()
// treats an empty return as a misconfiguration and shows a user-facing message
// rather than silently firing zero API requests.
//
// @returns {string[]} Array of job title strings, or [] if not configured
function getSearchTitles() {
  if (
    typeof API_CONFIG === 'undefined' ||
    !Array.isArray(API_CONFIG.SEARCH_TITLES) ||
    API_CONFIG.SEARCH_TITLES.length === 0
  ) {
    console.warn('SEARCH_TITLES is missing or empty in config.js. Add a SEARCH_TITLES array to use "Search all titles".');
    return [];
  }
  return API_CONFIG.SEARCH_TITLES;
}

// Note: Adzuna credentials (AID, AKEY) removed — replaced by Reed.co.uk integration.
// The Reed API key is read inside fetchReedJobs() rather than at module level,
// so test code can override global.API_CONFIG per-test without reloading the module.
const TRACKER_KEY = 'jst_tracker_v1';
const SEEN_KEY = 'jst_seen_v1';
const COMPANIES_KEY = 'jst_companies_v1';


function getTracker() { try { return JSON.parse(localStorage.getItem(TRACKER_KEY) || '{}'); } catch { return {}; } }
function saveTracker(d) { localStorage.setItem(TRACKER_KEY, JSON.stringify(d)); updateTrackerNav(); }
function getSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } }
function saveSeen(ids) { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); }

// ─── getCompanies ─────────────────────────────────────────────────────────────
// Returns the company list, preferring localStorage so user edits persist across sessions.
// On first load (no localStorage data), seeds from API_CONFIG.DEFAULT_COMPANIES and saves
// to localStorage so subsequent loads don't re-read config.
//
// Returns [] and logs a warning if localStorage is empty and DEFAULT_COMPANIES is not
// configured — the UI shows an empty state rather than crashing.
//
// @returns {Array} Array of company objects
function getCompanies() {
  // Prefer localStorage — user may have added, edited, or removed companies since first load
  const stored = JSON.parse(localStorage.getItem(COMPANIES_KEY));
  if (stored) return stored;

  // Nothing in localStorage — seed from config on first load
  if (
    typeof API_CONFIG === 'undefined' ||
    !Array.isArray(API_CONFIG.DEFAULT_COMPANIES) ||
    API_CONFIG.DEFAULT_COMPANIES.length === 0
  ) {
    console.warn('DEFAULT_COMPANIES is missing or empty in config.js. Add a DEFAULT_COMPANIES array to seed the company list.');
    return [];
  }

  // Save config defaults to localStorage so edits made later are preserved
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(API_CONFIG.DEFAULT_COMPANIES));
  return API_CONFIG.DEFAULT_COMPANIES;
}
function saveCompanies(companies) { localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies)); }

// ─── sortCompanies ────────────────────────────────────────────────────────────
// Returns a new sorted array — never mutates the input.
//
// sortKey options:
//   'alpha-asc'  — A→Z by name (default when no key provided)
//   'alpha-desc' — Z→A by name
//   'date-asc'   — oldest lastClicked first; nulls go to the bottom
//   'date-desc'  — newest lastClicked first; nulls go to the bottom
//
// Null lastClicked means the company has never been visited. It is deliberately
// placed at the bottom of date sorts (not the top) so "never checked" entries
// don't crowd out entries with real dates in either direction.
function sortCompanies(companies, sortKey = 'alpha-asc') {
  // Spread to avoid mutating the caller's array
  const sorted = [...companies];

  sorted.sort((a, b) => {
    if (sortKey === 'alpha-asc') {
      return a.name.localeCompare(b.name);
    }

    if (sortKey === 'alpha-desc') {
      return b.name.localeCompare(a.name);
    }

    if (sortKey === 'date-asc' || sortKey === 'date-desc') {
      const aNull = a.lastClicked === null || a.lastClicked === undefined;
      const bNull = b.lastClicked === null || b.lastClicked === undefined;

      // Nulls always sink to the bottom regardless of sort direction
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      const aTime = new Date(a.lastClicked).getTime();
      const bTime = new Date(b.lastClicked).getTime();

      // date-asc: oldest first (smallest timestamp first)
      // date-desc: newest first (largest timestamp first)
      return sortKey === 'date-asc' ? aTime - bTime : bTime - aTime;
    }

    // Unknown sort key — leave order unchanged
    return 0;
  });

  return sorted;
}

// ─── filterCompanies ──────────────────────────────────────────────────────────
// Returns a new filtered array — never mutates the input.
//
// options:
//   tag     — only include companies whose tags array contains this string
//              (case-insensitive match)
//   daysAgo — only include companies whose lastClicked is older than N days ago,
//              OR whose lastClicked is null (never checked = most stale)
//
// Both filters are optional. If neither is provided the full list is returned.
// Filters compose: pass the result of filterCompanies into sortCompanies to
// get a filtered + sorted set.
function filterCompanies(companies, { tag, daysAgo } = {}) {
  let result = companies;

  if (tag) {
    const needle = tag.toLowerCase();
    // Keep companies that have at least one tag matching the search (case-insensitive)
    result = result.filter(c =>
      c.tags.some(t => t.toLowerCase() === needle)
    );
  }

  if (daysAgo !== undefined && daysAgo !== null) {
    // Calculate the cutoff timestamp: anything checked after this is "fresh"
    const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

    result = result.filter(c => {
      // null means never checked — always include (it is the most stale)
      if (c.lastClicked === null || c.lastClicked === undefined) return true;
      // Include companies last checked before the cutoff (i.e. stale ones)
      return new Date(c.lastClicked).getTime() < cutoff;
    });
  }

  return result;
}

function openAddCompanyModal() {
  document.getElementById('modal-title').textContent = 'Add new company';
  document.getElementById('modal-submit-btn').textContent = 'Save company';
  document.getElementById('edit-index').value = '-1';
  document.getElementById('add-company-modal').classList.add('active');
  document.getElementById('company-name').focus();
}

function openEditCompanyModal(index) {
  const companies = getCompanies();
  const company = companies[index];
  if (!company) return;

  document.getElementById('modal-title').textContent = 'Edit company';
  document.getElementById('modal-submit-btn').textContent = 'Update company';
  document.getElementById('edit-index').value = index.toString();

  document.getElementById('company-name').value = company.name;
  document.getElementById('company-location').value = company.location;
  document.getElementById('company-url').value = company.url;
  document.getElementById('company-tags').value = company.tags.join(', ');
  document.getElementById('company-status').value = company.status || '';
  document.getElementById('company-role').value = company.roleApplied || '';
  document.getElementById('company-info').value = company.usefulInfo || '';

  document.getElementById('add-company-modal').classList.add('active');
  document.getElementById('company-name').focus();
}

function closeModal() {
  document.getElementById('add-company-modal').classList.remove('active');
  document.getElementById('add-company-form').reset();
  document.getElementById('modal-title').textContent = 'Add new company';
  document.getElementById('modal-submit-btn').textContent = 'Save company';
  document.getElementById('edit-index').value = '-1';
}

function removeCompany(name) {
  const companies = getCompanies().filter(c => c.name !== name);
  saveCompanies(companies);
  renderCompanies();
}

function toggleExpand(index) {
  const expanded = document.getElementById(`expanded-${index}`);
  const btn = expanded.previousElementSibling;
  if (expanded.classList.contains('active')) {
    expanded.classList.remove('active');
    btn.textContent = 'Show more info';
  } else {
    expanded.classList.add('active');
    btn.textContent = 'Hide more info';
  }
}

function saveCompanyInfo(index) {
  const companies = getCompanies();
  const company = companies[index];
  if (!company) return;
  const status = document.getElementById(`status-${index}`).value;
  const role = document.getElementById(`role-${index}`).value.trim();
  const info = document.getElementById(`info-${index}`).value.trim();
  company.status = status || null;
  company.roleApplied = role;
  company.usefulInfo = info;
  company.lastUpdated = new Date().toISOString();
  saveCompanies(companies);
  renderCompanies();
}

function trackCompanyClick(name, url) {
  const companies = getCompanies();
  const company = companies.find(c => c.name === name);
  if (company) {
    company.lastClicked = new Date().toISOString();
    saveCompanies(companies);
    renderCompanies();
  }
  window.open(url, '_blank');
}

function updateTrackerNav() {
  const count = Object.keys(getTracker()).length;
  const btn = document.getElementById('tracker-nav-btn');
  if (!btn) return;
  btn.textContent = count > 0 ? `My tracker (${count})` : 'My tracker';
}

function show(id, btn) {
  if (!isFeatureEnabled(id)) return; // Don't show disabled features
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (id === 'tracker') renderTracker();
  if (id === 'companies') renderCompanies();
  if (id === 'alerts') renderAlerts();
}

function copyAlert(btn, text) {
  const decoded = text.replace(/&quot;/g, '"');
  navigator.clipboard.writeText(decoded).then(() => {
    btn.textContent = 'Copied!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy string'; btn.classList.remove('copied'); }, 2000);
  });
}

// ─── fetchReedJobs ────────────────────────────────────────────────────────────
// Pure data-fetching function for the Reed.co.uk API.
//
// This is the testable core of the live job search feature. It is kept separate
// from the UI-level fetchJobs() function so it can be unit tested in isolation
// without needing a real DOM, a running server, or a valid API key.
//
// WHY WE USE A LOCAL PROXY
// ────────────────────────
// Reed.co.uk does not send CORS headers in its API responses. If the browser
// called Reed directly, the browser would block the response. Instead, this
// function calls the local proxy endpoint (/api/reed/search), which is the same
// origin as the app (no CORS check). server.js receives that request and forwards
// it server-side to Reed — server-to-server HTTPS calls are not CORS-restricted.
//
// PROXY ENDPOINT
// ──────────────
//   Browser calls:  GET /api/reed/search?keywords=...&locationName=...
//   Proxy forwards: GET https://www.reed.co.uk/api/1.0/search?keywords=...&locationName=...
//   See server.js for the proxy implementation.
//
// AUTH
// ────
// Reed uses HTTP Basic Auth: API key as username, empty string as password.
// Header format: Authorization: Basic <base64(apiKey + ':')>
// The colon separator is required by the HTTP Basic Auth spec (RFC 7617).
// This header is built here and forwarded by the proxy to Reed unchanged.
//
// Reed API response shape (relevant fields only):
//   {
//     results: [
//       {
//         jobId:          number,   // Unique job identifier
//         jobTitle:       string,   // e.g. "Delivery Manager"
//         employerName:   string,   // e.g. "Acme Corp"
//         locationName:   string,   // e.g. "Dublin"
//         minimumSalary:  number,   // GBP — Reed is a UK job board (salaries in £)
//         maximumSalary:  number,   // GBP
//         date:           string,   // ISO 8601 posting date
//         jobDescription: string,   // Plain text description
//         jobUrl:         string,   // Direct link to the Reed job listing
//       },
//       ...
//     ]
//   }
//
// @param {string} keywords     - Job title / keyword (e.g. 'delivery manager')
// @param {string} locationName - Location (e.g. 'Ireland', 'Dublin')
// @returns {Promise<Array>} Resolves to the results array from the Reed API
// @throws {Error} If the API key is missing or the proxy/API returns a non-200 status
async function fetchReedJobs(keywords, locationName) {
  // Read the API key from config inside the function — not at module level.
  // This ensures test code can set global.API_CONFIG before calling and see the change,
  // without needing to reload the module between tests.
  const reedApiKey = (typeof API_CONFIG !== 'undefined' && API_CONFIG.REED_API_KEY)
    ? API_CONFIG.REED_API_KEY
    : '';

  // Guard: fail early with a clear message if no key is configured.
  // Without a key, the proxy would forward an empty Authorization header and Reed
  // would return 401, but throwing here gives a clearer error and avoids the round trip.
  if (!reedApiKey) {
    throw new Error('Reed API key is not configured. Add REED_API_KEY to config.js.');
  }

  // Build the Basic Auth credential string: base64-encode "apiKey:" (key + colon + empty password).
  // btoa() is available in all modern browsers and in jsdom (the Jest test environment).
  // No Node.js Buffer fallback needed — this code runs in browser/jsdom only.
  const credentials = btoa(reedApiKey + ':');

  // Wrap keywords in double-quotes so Reed treats the input as an exact phrase,
  // not individual OR-matched terms.
  //
  // WITHOUT quotes: keywords=engineering+manager
  //   Reed returns any job containing "engineering" OR "manager" anywhere in the
  //   title or description — a vast, irrelevant result set.
  //
  // WITH quotes:    keywords=%22engineering+manager%22
  //   Reed returns only jobs where the exact phrase appears, e.g. "Engineering
  //   Manager", "Senior Engineering Manager". Dramatically more relevant results.
  //
  // URLSearchParams encodes the surrounding " characters as %22 automatically.
  // Quoting a single-word keyword is harmless — consistent behaviour across all searches.
  const params = new URLSearchParams({ keywords: `"${keywords}"`, locationName });
  const proxyUrl = '/api/reed/search?' + params.toString();

  // Make the authenticated request to the local proxy.
  // The proxy forwards the Authorization header to Reed unchanged.
  const response = await fetch(proxyUrl, {
    headers: {
      // Standard HTTP Basic Auth format: "Basic <base64encodedCredentials>"
      // server.js forwards this header to Reed as-is
      'Authorization': 'Basic ' + credentials
    }
  });

  // Surface API errors so the UI layer (fetchJobs) can catch them and show a message.
  // Without this check, a 401 or 500 response would return response.ok = false and
  // calling .json() might return an error body rather than the results array.
  if (!response.ok) {
    throw new Error(`Reed API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Reed wraps results in a 'results' array — return it directly, or an empty array
  // if the response is valid JSON but contains no results property.
  return data.results || [];
}

// ─── fetchJobs ────────────────────────────────────────────────────────────────
// UI-level function: reads form values, calls fetchReedJobs, and renders job cards.
// The try/catch here is intentional — fetchReedJobs throws on API errors and
// missing config, and we want to show a friendly message rather than a raw exception.
//
// NOTE: Reed.co.uk is a UK job board — salaries are displayed in GBP (£), not EUR (€).
// This is an API limitation. Reed does not provide Irish-specific salary data in EUR.
async function fetchJobs() {
  // Read the current form values from the search controls
  const role = document.getElementById('role-filter').value;
  const loc = document.getElementById('location-filter').value;
  const btn = document.getElementById('fetch-btn');
  const list = document.getElementById('jobs-list');

  // Guard against empty role input — the text field starts blank (unlike the old
  // dropdown which always had a pre-selected value), so we must check before fetching.
  if (!role.trim()) {
    list.innerHTML = '<div class="empty-state empty-state--error">Please enter a job title to search.</div>';
    return;
  }

  // Disable the button and show a loading spinner while the request is in flight
  btn.disabled = true; btn.textContent = 'Searching...';
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div>Fetching live jobs from Reed...</div>';

  // The location dropdown uses 'ireland' as the "All Ireland" option value.
  // Reed accepts 'Ireland' as a valid locationName for country-wide search.
  // Convert the dropdown value to a display-friendly location name.
  const locationName = loc === 'ireland' ? 'Ireland' : loc.charAt(0).toUpperCase() + loc.slice(1);

  try {
    // Delegate the actual HTTP call to fetchReedJobs — it handles auth, URL construction,
    // and error propagation. We just handle the UI side here.
    const jobs = await fetchReedJobs(role, locationName);

    // Track which jobs the user has already seen in previous searches.
    // Reed uses numeric jobId — store it as-is (JSON.stringify handles numbers fine).
    const seen = getSeen();
    const newIds = jobs.map(j => j.jobId).filter(id => !seen.includes(id));
    saveSeen([...new Set([...seen, ...jobs.map(j => j.jobId)])]);

    // Update the "last fetched" timestamp in the UI
    document.getElementById('last-fetched').textContent =
      'Last fetched: ' + new Date().toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

    if (!jobs.length) {
      list.innerHTML = '<div class="empty-state">No roles found. Try a different role type or location.</div>';
      btn.disabled = false; btn.textContent = 'Search'; return;
    }

    const tracker = getTracker();
    const newCount = newIds.length;
    const summary = `<div class="results-summary">Showing <span>${jobs.length}</span> roles${newCount > 0 ? ' &middot; <span style="color:var(--accent)">' + newCount + ' new since last search</span>' : ''}</div>`;

    // Build one card per job. Reed field names differ from Adzuna — see field mapping below:
    //   Reed field       → displayed as
    //   job.jobId        → card ID and tracker key
    //   job.jobTitle     → job title heading
    //   job.employerName → company name in meta line
    //   job.locationName → location in meta line
    //   job.minimumSalary / job.maximumSalary → salary range (GBP, shown as £xxk–£xxk)
    //   job.date         → posting date in meta line
    //   job.jobDescription → truncated description text
    //   job.jobUrl       → link to full listing on Reed
    const cards = jobs.map(job => {
      const isNew = newIds.includes(job.jobId);
      const isTracked = !!tracker[job.jobId];
      const company = job.employerName || '';
      const location = job.locationName || '';

      // Reed salaries are in GBP — display with £ symbol.
      // This is an API limitation (Reed is a UK board); salaries may not reflect
      // Irish market rates and do not convert to EUR automatically.
      const salary = job.minimumSalary && job.maximumSalary
        ? ' &middot; \u00a3' + Math.round(job.minimumSalary / 1000) + 'k\u2013\u00a3' + Math.round(job.maximumSalary / 1000) + 'k'
        : '';

      // Reed uses 'date' (not 'created') for the posting date
      const posted = job.date
        ? ' &middot; ' + new Date(job.date).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
        : '';

      // Strip any HTML tags from the description (Reed sometimes includes them),
      // then truncate to a readable preview length
      const desc = job.jobDescription
        ? job.jobDescription.replace(/<[^>]+>/g, '').substring(0, 220) + '...'
        : '';

      // Escape single quotes in string values used in inline onclick attributes.
      // Without this, a company name like "O'Brien Consulting" would break the HTML.
      const safeTitle = (job.jobTitle || '').replace(/'/g, "\\'");
      const safeCompany = company.replace(/'/g, "\\'");
      const safeUrl = (job.jobUrl || '').replace(/'/g, "\\'");

      return `<div class="job-card${isNew ? ' is-new' : ''}" id="jcard-${job.jobId}">
        <div class="job-header">
          <div class="job-title">${job.jobTitle}</div>
          ${isNew ? '<span class="new-badge">New</span>' : ''}
        </div>
        <div class="job-meta">${company}${location ? ' &middot; ' + location : ''}${salary}${posted}</div>
        <div class="job-desc">${desc}</div>
        <div class="job-actions">
          <a class="job-link" href="${job.jobUrl}" target="_blank">View role &rarr;</a>
          ${isTracked
          ? '<span class="tracked-label">Tracked</span>'
          : `<button class="track-btn" onclick="addToTracker('${job.jobId}','${safeTitle}','${safeCompany}','${safeUrl}')">+ Track</button>`
        }
        </div>
      </div>`;
    }).join('');

    list.innerHTML = summary + '<div class="jobs-list">' + cards + '</div>';
  } catch (e) {
    // fetchReedJobs throws on missing key or non-200 response — catch and show user-facing message
    list.innerHTML = '<div class="empty-state empty-state--error">Error fetching jobs. Check your internet connection and API key, then try again.</div>';
  }
  btn.disabled = false; btn.textContent = 'Search';
}

// ─── fetchAllJobs ─────────────────────────────────────────────────────────────
// "Search all titles" mode: fires one Reed API request per job title in parallel,
// deduplicates the combined results, and renders everything sorted newest-first.
//
// Each individual request is caught separately (.catch(() => [])) so that a
// single failed title doesn't wipe out results from the others.
async function fetchAllJobs() {
  const loc = document.getElementById('location-filter').value;
  const btn = document.getElementById('fetch-all-btn');
  const list = document.getElementById('jobs-list');
  btn.disabled = true; btn.textContent = 'Searching...';
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div>Searching all titles — this may take a moment...</div>';

  // Read search titles from config — warns and returns [] if SEARCH_TITLES is missing or empty
  const coreTitles = getSearchTitles();
  if (!coreTitles.length) {
    // getSearchTitles() already logged a console warning; show a user-facing message too
    list.innerHTML = '<div class="empty-state empty-state--error">No search titles configured. Add a SEARCH_TITLES array to config.js.</div>';
    btn.disabled = false; btn.textContent = 'Search all titles';
    return;
  }

  // Normalise the location dropdown value to a Reed-friendly location name
  const locationName = loc === 'ireland' ? 'Ireland' : loc.charAt(0).toUpperCase() + loc.slice(1);

  try {
    // Fire all requests in parallel — each calls fetchReedJobs which handles auth.
    // Individual title failures are silently caught and return [] so the rest succeed.
    const requests = coreTitles.map(title =>
      fetchReedJobs(title, locationName).catch(() => [])
    );

    const results = await Promise.all(requests);
    const seen = getSeen();

    // Deduplicate by jobId — the same listing may appear under multiple search titles
    const seenIds = new Set();
    const allJobs = [];
    results.flat().forEach(job => {
      if (!seenIds.has(job.jobId)) {
        seenIds.add(job.jobId);
        allJobs.push(job);
      }
    });

    // Sort combined results newest-first using Reed's 'date' field
    allJobs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const newIds = allJobs.map(j => j.jobId).filter(id => !seen.includes(id));
    saveSeen([...new Set([...seen, ...allJobs.map(j => j.jobId)])]);

    document.getElementById('last-fetched').textContent =
      'Last fetched: ' + new Date().toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

    if (!allJobs.length) {
      list.innerHTML = '<div class="empty-state">No roles found.</div>';
      btn.disabled = false; btn.textContent = 'Search all titles'; return;
    }

    const tracker = getTracker();
    const newCount = newIds.length;
    const summary = `<div class="results-summary">Showing <span>${allJobs.length}</span> roles across all titles${newCount > 0 ? ' &middot; <span style="color:var(--accent)">' + newCount + ' new since last search</span>' : ''}</div>`;

    // Card rendering — same Reed field mapping as fetchJobs() above.
    // Salaries are in GBP (£) — Reed is a UK job board; EUR is not available.
    const cards = allJobs.map(job => {
      const isNew = newIds.includes(job.jobId);
      const isTracked = !!tracker[job.jobId];
      const company = job.employerName || '';
      const location = job.locationName || '';
      const salary = job.minimumSalary && job.maximumSalary
        ? ' &middot; \u00a3' + Math.round(job.minimumSalary / 1000) + 'k\u2013\u00a3' + Math.round(job.maximumSalary / 1000) + 'k'
        : '';
      const posted = job.date
        ? ' &middot; ' + new Date(job.date).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
        : '';
      const desc = job.jobDescription
        ? job.jobDescription.replace(/<[^>]+>/g, '').substring(0, 220) + '...'
        : '';
      const safeTitle = (job.jobTitle || '').replace(/'/g, "\\'");
      const safeCompany = company.replace(/'/g, "\\'");
      const safeUrl = (job.jobUrl || '').replace(/'/g, "\\'");

      return `<div class="job-card${isNew ? ' is-new' : ''}" id="jcard-${job.jobId}">
        <div class="job-header">
          <div class="job-title">${job.jobTitle}</div>
          ${isNew ? '<span class="new-badge">New</span>' : ''}
        </div>
        <div class="job-meta">${company}${location ? ' &middot; ' + location : ''}${salary}${posted}</div>
        <div class="job-desc">${desc}</div>
        <div class="job-actions">
          <a class="job-link" href="${job.jobUrl}" target="_blank">View role &rarr;</a>
          ${isTracked
          ? '<span class="tracked-label">Tracked</span>'
          : `<button class="track-btn" onclick="addToTracker('${job.jobId}','${safeTitle}','${safeCompany}','${safeUrl}')">+ Track</button>`
        }
        </div>
      </div>`;
    }).join('');

    list.innerHTML = summary + '<div class="jobs-list">' + cards + '</div>';
  } catch (e) {
    list.innerHTML = '<div class="empty-state empty-state--error">Error fetching jobs. Check your connection and try again.</div>';
  }

  btn.disabled = false; btn.textContent = 'Search all titles';
}

function addToTracker(id, title, company, url) {
  const tracker = getTracker();
  tracker[id] = { id, title, company, url, status: 'new', note: '', savedAt: new Date().toISOString() };
  saveTracker(tracker);
  const card = document.getElementById('jcard-' + id);
  if (card) {
    const btn = card.querySelector('.track-btn');
    if (btn) btn.outerHTML = '<span class="tracked-label">Tracked</span>';
  }
}

function renderTracker() {
  const tracker = getTracker();
  const content = document.getElementById('tracker-content');
  if (!content) return;
  const items = Object.values(tracker);

  if (!items.length) {
    content.innerHTML = '<div class="empty-state">No roles tracked yet. Search for live jobs and hit "+ Track" on anything interesting.</div>';
    return;
  }

  const order = { interviewing: 0, applied: 1, new: 2, skipped: 3 };
  items.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  const pillClass = { new: 'pill-new', applied: 'pill-applied', interviewing: 'pill-interviewing', skipped: 'pill-skipped' };
  const pillLabel = { new: 'New', applied: 'Applied', interviewing: 'Interviewing', skipped: 'Skipped' };

  content.innerHTML = `
    <button class="clear-btn" onclick="clearTracker()">Clear all tracked roles</button>
    <div class="tracker-list">
      ${items.map(item => `
        <div class="tracker-card">
          <div class="tracker-main">
            <div class="tracker-title"><a href="${item.url}" target="_blank">${item.title}</a></div>
            <div class="tracker-company">${item.company}</div>
            <div class="tracker-saved">Saved ${new Date(item.savedAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            ${item.note ? `<div class="tracker-note-display">${item.note}</div>` : ''}
          </div>
          <div class="tracker-controls">
            <span class="status-pill ${pillClass[item.status]}">${pillLabel[item.status]}</span>
            <select class="status-sel" onchange="updateStatus('${item.id}', this.value)">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
              <option value="applied" ${item.status === 'applied' ? 'selected' : ''}>Applied</option>
              <option value="interviewing" ${item.status === 'interviewing' ? 'selected' : ''}>Interviewing</option>
              <option value="skipped" ${item.status === 'skipped' ? 'selected' : ''}>Skipped</option>
            </select>
            <input class="note-field" type="text" placeholder="Add a note..." value="${item.note || ''}"
              onblur="updateNote('${item.id}', this.value)"
              onkeydown="if(event.key==='Enter')this.blur()">
          </div>
        </div>`).join('')}
    </div>`;
}

function updateStatus(id, status) {
  const t = getTracker(); if (t[id]) { t[id].status = status; saveTracker(t); renderTracker(); }
}
function updateNote(id, note) {
  const t = getTracker(); if (t[id]) { t[id].note = note; saveTracker(t); }
}
function clearTracker() {
  if (confirm('Clear all tracked roles? This cannot be undone.')) {
    localStorage.removeItem(TRACKER_KEY); updateTrackerNav(); renderTracker();
  }
}

async function scoreJob() {
  const jd = document.getElementById('jd').value.trim();
  if (!jd) return;
  const btn = document.getElementById('analyse-btn');
  const result = document.getElementById('score-result');
  btn.disabled = true; btn.textContent = 'Analysing...';
  result.innerHTML = '<div class="loading-state"><div class="spinner"></div>Reading the job description...</div>';

  const profile = (typeof API_CONFIG !== 'undefined' && API_CONFIG.PROFILE_SUMMARY) ? API_CONFIG.PROFILE_SUMMARY : 'Add your professional summary in config.js';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        messages: [{ role: 'user', content: `You are a senior recruiter assessing job fit. Candidate:\n\n${profile}\n\nJob description:\n\n${jd}\n\nReturn ONLY valid JSON (no markdown) with: score (0-100 int), verdict (1 sentence max 20 words), strengths (3-4 strings max 15 words each), gaps (2-3 strings max 15 words each), positioning (1 paragraph max 60 words), apply (boolean).` }]
      })
    });
    const data = await res.json();
    const r = JSON.parse(data.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim());
    const fc = r.score >= 70 ? '#2D5A3D' : r.score >= 50 ? '#BA7517' : '#B03A2E';

    result.innerHTML = `<div class="result-box">
      <div class="score-row">
        <span class="score-big">${r.score}</span>
        <span class="score-denom">/ 100</span>
        <span class="apply-badge ${r.apply ? 'apply-yes' : 'apply-no'}">${r.apply ? 'Recommended' : 'Proceed with caution'}</span>
      </div>
      <div class="score-track"><div class="score-fill" style="width:${r.score}%;background:${fc};"></div></div>
      <div class="result-section">
        <div class="result-section-label">Verdict</div>
        <div class="verdict-text">${r.verdict}</div>
      </div>
      <div class="result-section">
        <div class="result-section-label">Strengths</div>
        ${r.strengths.map(s => `<div class="item-row"><span class="dot dot-green"></span>${s}</div>`).join('')}
      </div>
      <div class="result-section">
        <div class="result-section-label">Gaps / risks</div>
        ${r.gaps.map(g => `<div class="item-row"><span class="dot dot-amber"></span>${g}</div>`).join('')}
      </div>
      <div class="result-section">
        <div class="result-section-label">How to position yourself</div>
        <div class="positioning-text">${r.positioning}</div>
      </div>
    </div>`;
  } catch (e) {
    result.innerHTML = '<div class="loading-state empty-state--error">Something went wrong — check your connection and try again.</div>';
  }
  btn.disabled = false; btn.textContent = 'Analyse fit';
}

if (typeof module !== 'undefined') {
  /* eslint-disable-next-line no-undef */
  module.exports = {
    FEATURES,
    getTracker,
    saveTracker,
    getSeen,
    saveSeen,
    getCompanies,
    saveCompanies,
    sortCompanies,
    filterCompanies,
    updateStatus,
    updateNote,
    isFeatureEnabled,
    getDefaultTab,
    getLocale,
    fetchReedJobs,  // Exported so Jest unit tests can call it directly
    getSearchTitles // Exported so Jest unit tests can verify config-reading behaviour
  };
}