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
  scorer: false,   // Job fit scorer - disabled due to hardcoded personal profile
  summary: true    // Activity summary generator - enabled (JST-66)
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

// ─── getSearchTitleCount ──────────────────────────────────────────────────────
// Returns the number of titles configured in API_CONFIG.SEARCH_TITLES.
// Used by the mode toggle UI to display "N titles from config" next to the
// "All configured titles" option, and to disable the option gracefully if no
// titles have been added to config.js yet.
//
// @returns {number} Number of configured search titles, or 0 if not set
function getSearchTitleCount() {
  if (
    typeof API_CONFIG === 'undefined' ||
    !Array.isArray(API_CONFIG.SEARCH_TITLES)
  ) {
    return 0;
  }
  return API_CONFIG.SEARCH_TITLES.length;
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
  // Prefer localStorage — user may have added, edited, or removed companies since first load.
  // Normalize on read so every company carries an `updates` array (JST-62) regardless of when
  // it was saved — older stored data predates the field. This does not rewrite localStorage.
  const stored = JSON.parse(localStorage.getItem(COMPANIES_KEY));
  if (stored) return stored.map(normalizeCompany);

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
  // Normalize the seeded list too so callers always receive companies with an `updates` array.
  return API_CONFIG.DEFAULT_COMPANIES.map(normalizeCompany);
}
function saveCompanies(companies) { localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies)); }

// ─── Update card data model (JST-62) ──────────────────────────────────────────
// An "update card" records one role's status at a point in time. Each company holds
// an `updates` array of these cards, letting a user track multiple roles/applications
// per company without overwriting history. This is the data model only — rendering and
// CRUD UI land in JST-63, and migration of the legacy `currentStatus`/`usefulInfo`
// fields into cards is handled by JST-65, so those fields are left in place here.

// Allowed status values for an update card. Capitalised and intentionally distinct
// from the legacy company-level `status` field (lowercase 'applied'/'interviewing'/…),
// which this ticket leaves untouched so the two never get conflated.
const UPDATE_STATUSES = ['Considering', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'];

// isValidUpdateStatus — true iff the given value is one of the allowed UPDATE_STATUSES.
// @param {*} status
// @returns {boolean}
function isValidUpdateStatus(status) {
  return UPDATE_STATUSES.includes(status);
}

// createUpdateCard — canonical constructor for an update card. Returns a normalized
// card object with the four model fields. `role` and `notes` default to empty strings
// and `date` defaults to the current time (ISO string) so callers can omit them.
// `status` is required and validated: an out-of-enum or missing status is rejected by
// throwing, since a card without a meaningful status has no place in the model.
// @param {{ role?: string, status: string, date?: string, notes?: string }} fields
// @returns {{ role: string, status: string, date: string, notes: string }}
function createUpdateCard({ role = '', status, date, notes = '' } = {}) {
  if (!isValidUpdateStatus(status)) {
    throw new Error(`Invalid update status: ${status}. Must be one of: ${UPDATE_STATUSES.join(', ')}`);
  }
  return {
    role: String(role),
    status,
    // Default to now so a card always has a sortable date; callers pass an explicit
    // ISO date when recording a historical update.
    date: date || new Date().toISOString(),
    notes: String(notes)
  };
}

// validateUpdateCard — non-throwing validation for cards from untrusted sources
// (future import/UI). Returns { valid, errors } so the caller can surface every
// problem at once rather than failing on the first. Checks field types and that
// the status is a recognised enum value.
// @param {Object} card
// @returns {{ valid: boolean, errors: string[] }}
function validateUpdateCard(card) {
  const errors = [];
  if (typeof card.role !== 'string') errors.push('role must be a string');
  if (!isValidUpdateStatus(card.status)) errors.push(`status must be one of: ${UPDATE_STATUSES.join(', ')}`);
  // date is stored as an ISO string; require a non-empty string here. Format/parse
  // validation is left to callers that need it — the model only guarantees presence.
  if (typeof card.date !== 'string' || card.date === '') errors.push('date must be a non-empty string');
  if (typeof card.notes !== 'string') errors.push('notes must be a string');
  return { valid: errors.length === 0, errors };
}

// normalizeCompany — guarantees a company object carries an `updates` array, defaulting
// a missing or non-array value to []. Returns a shallow copy and leaves every other field
// (including legacy `status`/`usefulInfo`) untouched. Applied on read in getCompanies()
// so the in-memory shape always includes `updates` without rewriting stored data — that
// persistence/migration step belongs to JST-65.
// @param {Object} company
// @returns {Object} the company with a guaranteed `updates` array
function normalizeCompany(company) {
  return { ...company, updates: Array.isArray(company.updates) ? company.updates : [] };
}

// ─── Derived company status (JST-64) ───────────────────────────────────────────
// The company's displayed status is derived from its update cards rather than the legacy
// company.status field, so status lives in one place (the update log) and always reflects
// real activity. The legacy field is left in the data model until JST-65 removes it.

// getLatestUpdateCard — returns the update card with the most recent date, or null when the
// company has no updates. On a date tie the later-added card (higher index) wins, so the most
// recently logged update is treated as current. Unparseable/missing dates rank as oldest.
// @param {Object} company
// @returns {Object|null}
function getLatestUpdateCard(company) {
  const updates = (company && Array.isArray(company.updates)) ? company.updates : [];
  if (updates.length === 0) return null;

  // Reduce to the card with the greatest timestamp; `>=` makes a later index win on ties.
  return updates.reduce((latest, card) => {
    const cardTime = Date.parse(card.date) || 0;
    const latestTime = Date.parse(latest.date) || 0;
    return cardTime >= latestTime ? card : latest;
  });
}

// deriveCompanyStatus — the status to display for a company: the status of its most recent
// update card, or null when there are no updates (the UI shows a neutral "No updates" state).
// @param {Object} company
// @returns {string|null}
function deriveCompanyStatus(company) {
  const latest = getLatestUpdateCard(company);
  return latest ? latest.status : null;
}

// ─── Legacy data migration (JST-65) ────────────────────────────────────────────
// One-time migration that folds each company's legacy `usefulInfo` + `status` fields into a
// single update card, then removes both fields. Runs once on load (runCompanyMigration). The
// legacy `status` field used lowercase values; update cards use the capitalised UPDATE_STATUSES.

// mapLegacyStatus — maps a legacy lowercase company status to an update-card status.
// Blank/unknown values become 'Considering'; an already-valid capitalised value passes through.
// @param {*} value
// @returns {string} one of UPDATE_STATUSES
function mapLegacyStatus(value) {
  if (isValidUpdateStatus(value)) return value; // already a capitalised enum value
  const map = { applied: 'Applied', interviewing: 'Interviewing', rejected: 'Rejected', offer: 'Offer' };
  return map[value] || 'Considering';
}

// migrateCompanies — pure migration over a company array. For each company still carrying a
// legacy field, appends one update card (when there is content to preserve) and deletes both
// `usefulInfo` and `status`. Idempotent: a company without the legacy keys is left untouched,
// so re-running never duplicates cards. Returns the (mutated) array and whether anything changed.
// @param {Array} companies
// @returns {{ companies: Array, changed: boolean }}
function migrateCompanies(companies) {
  let changed = false;

  companies.forEach(company => {
    // Detection keys on the presence of either legacy field — both are removed below, so a
    // migrated company is never re-processed.
    const hasLegacy = Object.prototype.hasOwnProperty.call(company, 'usefulInfo') ||
                      Object.prototype.hasOwnProperty.call(company, 'status');
    if (!hasLegacy) return;

    const legacyInfo = typeof company.usefulInfo === 'string' ? company.usefulInfo : '';
    const legacyStatus = company.status;
    const hasContent = legacyInfo.trim() !== '' || (legacyStatus != null && legacyStatus !== '');

    if (hasContent) {
      if (!Array.isArray(company.updates)) company.updates = [];
      // Role is left blank per the migration spec — the old model had no per-role granularity.
      company.updates.push(createUpdateCard({
        role: '',
        status: mapLegacyStatus(legacyStatus),
        date: new Date().toISOString(),
        notes: legacyInfo
      }));
    }

    delete company.usefulInfo;
    delete company.status;
    changed = true;
  });

  return { companies, changed };
}

// runCompanyMigration — on-load entry point. Reads the stored companies, migrates them, and
// persists only when something changed. Kept free of DOM/render calls so the init sequence
// controls rendering and so it is safe to unit test under Jest.
function runCompanyMigration() {
  const { companies, changed } = migrateCompanies(getCompanies());
  if (changed) saveCompanies(companies);
}

// ─── Update card CRUD (JST-63) ─────────────────────────────────────────────────
// These mutate a single company's `updates` array and persist via saveCompanies,
// mirroring the saveCompanyInfo/removeCompany pattern (read → locate by index → mutate
// → save → re-render). The company is located by its index in the full array — the same
// index the modal's edit handlers carry in the #edit-index hidden field. Each returns a
// result object so the modal can show inline validation errors instead of throwing.
// renderCompanies is guarded because it lives in app-dom.js and is absent under Jest.

// addUpdateCard — appends a new update card to the company at companyIndex.
// Builds the card through createUpdateCard so the model's defaulting and status
// validation are reused; a thrown validation error is converted into { ok:false, errors }.
// @param {number} companyIndex
// @param {{ role?: string, status: string, date?: string, notes?: string }} fields
// @returns {{ ok: true, updates: Object[] } | { ok: false, errors: string[] }}
function addUpdateCard(companyIndex, fields) {
  const companies = getCompanies();
  const company = companies[companyIndex];
  if (!company) return { ok: false, errors: ['company not found'] };

  let card;
  try {
    card = createUpdateCard(fields);
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }

  company.updates.push(card);
  saveCompanies(companies);
  if (typeof renderCompanies === 'function') renderCompanies();
  return { ok: true, updates: company.updates };
}

// editUpdateCard — replaces the card at cardIndex on the company at companyIndex.
// Validates both the index range and (via createUpdateCard) the new field values, so an
// invalid edit leaves the existing card untouched.
// @param {number} companyIndex
// @param {number} cardIndex
// @param {{ role?: string, status: string, date?: string, notes?: string }} fields
// @returns {{ ok: true, updates: Object[] } | { ok: false, errors: string[] }}
function editUpdateCard(companyIndex, cardIndex, fields) {
  const companies = getCompanies();
  const company = companies[companyIndex];
  if (!company) return { ok: false, errors: ['company not found'] };
  if (cardIndex < 0 || cardIndex >= company.updates.length) {
    return { ok: false, errors: ['update card not found'] };
  }

  let card;
  try {
    card = createUpdateCard(fields);
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }

  company.updates[cardIndex] = card;
  saveCompanies(companies);
  if (typeof renderCompanies === 'function') renderCompanies();
  return { ok: true, updates: company.updates };
}

// deleteUpdateCard — removes the card at cardIndex from the company at companyIndex.
// An out-of-range index is a guarded no-op so a stale UI click can't corrupt the array.
// @param {number} companyIndex
// @param {number} cardIndex
// @returns {{ ok: true, updates: Object[] } | { ok: false, errors: string[] }}
function deleteUpdateCard(companyIndex, cardIndex) {
  const companies = getCompanies();
  const company = companies[companyIndex];
  if (!company) return { ok: false, errors: ['company not found'] };
  if (cardIndex < 0 || cardIndex >= company.updates.length) {
    return { ok: false, errors: ['update card not found'] };
  }

  company.updates.splice(cardIndex, 1);
  saveCompanies(companies);
  if (typeof renderCompanies === 'function') renderCompanies();
  return { ok: true, updates: company.updates };
}

// ─── Activity summary generator (JST-66) ───────────────────────────────────────
// Cross-company reporting: given a date range, collect every update card whose date
// falls within it and format the result as a copyable Markdown log grouped by company.
// Both functions are pure (no DOM, no localStorage) so they are unit-testable; the
// Activity summary panel, Generate button, and copy-to-clipboard live in app-dom.js.

// filterUpdatesInRange — returns one { name, updates } entry per company that has at
// least one update card within the inclusive date range, with that company's matching
// cards sorted by date ascending. Companies with no in-range cards are omitted.
// startDate/endDate are YYYY-MM-DD strings from the panel's native date inputs; they are
// widened to a full UTC day (00:00:00.000 → 23:59:59.999) so the comparison matches the
// UTC-midnight convention update cards are stored with (see submitUpdateForm) and so a
// card dated on the end day is included rather than excluded.
// @param {Array} companies
// @param {string} startDate — inclusive lower bound, 'YYYY-MM-DD'
// @param {string} endDate — inclusive upper bound, 'YYYY-MM-DD'
// @returns {{ name: string, updates: Object[] }[]}
function filterUpdatesInRange(companies, startDate, endDate) {
  const startTime = Date.parse(`${startDate}T00:00:00.000Z`);
  const endTime = Date.parse(`${endDate}T23:59:59.999Z`);

  return (companies || []).reduce((acc, company) => {
    const updates = Array.isArray(company.updates) ? company.updates : [];
    const inRange = updates.filter(card => {
      const cardTime = Date.parse(card.date);
      // A missing/unparseable date yields NaN, which fails both comparisons and is dropped.
      return cardTime >= startTime && cardTime <= endTime;
    });
    if (inRange.length === 0) return acc;
    // Copy before sorting so we never reorder the company's stored updates array.
    const sorted = inRange.slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    acc.push({ name: company.name, updates: sorted });
    return acc;
  }, []);
}

// buildActivitySummary — formats the in-range activity as a Markdown string: one `##`
// heading per company, then one bullet per update card carrying status, role (omitted
// when blank), and date, with any notes on an indented continuation line. Dates are
// formatted in UTC to match renderUpdateCards and avoid an off-by-one day shift. When
// nothing falls in the range it returns a single human-readable empty-state line so the
// UI can show the message verbatim instead of a blank area.
// @param {Array} companies
// @param {string} startDate — 'YYYY-MM-DD'
// @param {string} endDate — 'YYYY-MM-DD'
// @returns {string} Markdown summary (or an empty-state message)
function buildActivitySummary(companies, startDate, endDate) {
  const groups = filterUpdatesInRange(companies, startDate, endDate);

  if (groups.length === 0) {
    return `No activity between ${startDate} and ${endDate}.`;
  }

  // Blank line between company blocks keeps the Markdown (and plain-text paste) readable.
  return groups.map(group => {
    const lines = [`## ${group.name}`];
    group.updates.forEach(card => {
      const dateLabel = card.date
        ? new Date(card.date).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
        : '';
      // Role is optional, so only join the segments that have content.
      const segments = [`**${card.status}**`, card.role, dateLabel].filter(Boolean);
      lines.push(`- ${segments.join(' — ')}`);
      if (card.notes) lines.push(`  ${card.notes}`);
    });
    return lines.join('\n');
  }).join('\n\n');
}

// escapeHtml — escapes the five HTML-significant characters so free-text update-card
// fields (role, notes) can be safely interpolated into innerHTML markup. Returns '' for
// null/undefined so empty fields don't render the literal strings "null"/"undefined".
// @param {*} value
// @returns {string}
function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Export functions ─────────────────────────────────────────────────────────

// escapeCSVField — wraps a field value in double-quotes when it contains a comma,
// double-quote, or newline (RFC 4180 compliance). Escapes internal double-quotes as "".
// Returns an empty string for null/undefined so the CSV column is always populated.
// @param {*} val
// @returns {string}
function escapeCSVField(val) {
  const str = val == null ? '' : String(val);
  // Only quote fields that require it — keeps output readable for common values
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// companiesToCSV — serializes a company array to a CSV string.
// Column order: name, location, url, tags, status, roleApplied, usefulInfo, lastClicked, lastUpdated
// Tags are pipe-joined ("EM|Delivery") to avoid ambiguity with the comma delimiter.
// @param {Array} companies
// @returns {string} CSV text
function companiesToCSV(companies) {
  const HEADERS = ['name', 'location', 'url', 'tags', 'status', 'roleApplied', 'usefulInfo', 'lastClicked', 'lastUpdated'];
  const rows = [HEADERS.join(',')];
  companies.forEach(c => {
    const row = [
      escapeCSVField(c.name),
      escapeCSVField(c.location),
      escapeCSVField(c.url),
      escapeCSVField(Array.isArray(c.tags) ? c.tags.join('|') : (c.tags || '')),
      escapeCSVField(c.status),
      escapeCSVField(c.roleApplied),
      escapeCSVField(c.usefulInfo),
      escapeCSVField(c.lastClicked),
      escapeCSVField(c.lastUpdated)
    ];
    rows.push(row.join(','));
  });
  return rows.join('\n');
}

// companiesToJSON — serializes a company array to a pretty-printed JSON string.
// @param {Array} companies
// @returns {string} JSON text
function companiesToJSON(companies) {
  return JSON.stringify(companies, null, 2);
}

// triggerFileDownload — triggers a browser file download without a server round-trip.
// Creates a temporary Blob URL attached to an invisible <a>, clicks it, then revokes
// the URL after a short delay to allow the browser to begin the download.
// @param {string} filename
// @param {string} content   — file contents as a string
// @param {string} mimeType  — e.g. 'text/csv' or 'application/json'
function triggerFileDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the download has time to start before the URL is freed
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// exportCompanies — entry point for the Export CSV / Export JSON buttons.
// Reads the current company list, serialises it, and triggers a browser download.
// The filename includes today's date (YYYY-MM-DD) for easy identification.
// @param {'csv'|'json'} format
function exportCompanies(format) {
  const companies = getCompanies();
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    triggerFileDownload(`companies-${date}.csv`, companiesToCSV(companies), 'text/csv');
  } else if (format === 'json') {
    triggerFileDownload(`companies-${date}.json`, companiesToJSON(companies), 'application/json');
  }
}

// ─── Import functions ─────────────────────────────────────────────────────────

// parseCSVRow — splits a single CSV line into fields, respecting RFC 4180 quoting.
// Handles embedded commas and double-quotes (escaped as "") within quoted fields.
// Does not support multi-line fields (newlines inside quoted values) — not needed
// for the company schema.
// @param {string} row
// @returns {string[]}
function parseCSVRow(row) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        // "" inside a quoted field is an escaped double-quote
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
  }
  fields.push(field);
  return fields;
}

// parseCSVToCompanies — parses CSV text into an array of company objects.
// The first row is used as the header to map column positions to field names.
// Tags are pipe-split ("EM|Delivery" → ['EM', 'Delivery']) since pipes are used
// as the intra-field delimiter to avoid clashing with commas.
// Required: name and url — rows missing either are added to skipped with a reason.
// @param {string} csvText
// @returns {{ imported: Object[], skipped: Array<{row: number, reason: string}> }}
function parseCSVToCompanies(csvText) {
  // Normalise Windows and old Mac line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return { imported: [], skipped: [] };

  const headers = parseCSVRow(lines[0]);
  const imported = [];
  const skipped = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip blank trailing lines

    const values = parseCSVRow(line);
    const entry = {};
    headers.forEach((h, idx) => {
      entry[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });

    if (!entry.name) {
      skipped.push({ row: i + 1, reason: 'missing required field: name' });
      continue;
    }
    if (!entry.url) {
      skipped.push({ row: i + 1, reason: 'missing required field: url' });
      continue;
    }

    // Restore tags from pipe-delimited string to array
    entry.tags = entry.tags ? entry.tags.split('|').map(t => t.trim()).filter(Boolean) : [];

    // Normalise empty CSV fields back to null so the shape matches the app's data model
    ['status', 'roleApplied', 'usefulInfo', 'lastClicked', 'lastUpdated'].forEach(field => {
      if (entry[field] === '') entry[field] = null;
    });

    imported.push(entry);
  }

  return { imported, skipped };
}

// parseJSONToCompanies — parses a JSON string into an array of company objects.
// Expects a top-level array — returns an error for invalid JSON or non-array input.
// Skips individual entries that are missing name or url.
// @param {string} jsonText
// @returns {{ imported: Object[], skipped: Array<{index: number, reason: string}>, error?: string }}
function parseJSONToCompanies(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return { imported: [], skipped: [], error: `Invalid JSON: ${e.message}` };
  }

  if (!Array.isArray(data)) {
    return { imported: [], skipped: [], error: 'JSON must be an array of company objects' };
  }

  const imported = [];
  const skipped = [];

  data.forEach((entry, i) => {
    if (!entry.name) {
      skipped.push({ index: i, reason: 'missing required field: name' });
      return;
    }
    if (!entry.url) {
      skipped.push({ index: i, reason: 'missing required field: url' });
      return;
    }
    // Ensure tags is always an array regardless of what was in the JSON
    if (!Array.isArray(entry.tags)) entry.tags = [];
    imported.push(entry);
  });

  return { imported, skipped };
}

// mergeImportedCompanies — merges parsed company objects into the existing list.
// Deduplicates by name (case-sensitive): if a company with the same name already
// exists, it is counted as a duplicate and not added — existing data is never overwritten.
// @param {{ imported: Object[], skipped: Array }} parseResult
// @returns {{ added: number, duplicates: number, skipped: number }}
function mergeImportedCompanies(parseResult) {
  const existing = getCompanies();
  const existingNames = new Set(existing.map(c => c.name));

  let added = 0;
  let duplicates = 0;
  const merged = [...existing];

  parseResult.imported.forEach(company => {
    if (existingNames.has(company.name)) {
      duplicates++;
    } else {
      merged.push(company);
      existingNames.add(company.name);
      added++;
    }
  });

  saveCompanies(merged);
  // renderCompanies is defined in app-dom.js and is not available in the Node test environment
  if (typeof renderCompanies === 'function') renderCompanies();

  return { added, duplicates, skipped: parseResult.skipped.length };
}

// handleCompanyImport — called from the file input's onchange handler.
// Reads the selected file via FileReader and routes it to the correct parser
// based on file extension (.csv or .json). Shows feedback after the import.
// @param {File} file
function handleCompanyImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const ext = file.name.split('.').pop().toLowerCase();
    let parseResult;
    if (ext === 'csv') {
      parseResult = parseCSVToCompanies(text);
    } else if (ext === 'json') {
      parseResult = parseJSONToCompanies(text);
    } else {
      showImportFeedback({ error: `Unsupported file type: .${ext}. Use .csv or .json.` });
      return;
    }

    if (parseResult.error) {
      showImportFeedback({ error: parseResult.error });
      return;
    }

    const summary = mergeImportedCompanies(parseResult);
    showImportFeedback(summary);
  };
  reader.onerror = () => showImportFeedback({ error: 'Could not read the file.' });
  reader.readAsText(file);
}

// showImportFeedback — updates #import-feedback with a human-readable import summary.
// Uses 'success' styling for a clean import and 'error' styling for failures.
// Auto-hides after 5 seconds so the message doesn't linger.
// @param {{ added?: number, duplicates?: number, skipped?: number, error?: string }} result
function showImportFeedback(result) {
  const el = document.getElementById('import-feedback');
  if (!el) return;

  el.removeAttribute('hidden');
  el.className = 'import-feedback'; // Reset any prior state class

  if (result.error) {
    el.classList.add('error');
    el.textContent = `Import failed: ${result.error}`;
  } else {
    const parts = [];
    if (result.added > 0) {
      parts.push(`${result.added} ${result.added === 1 ? 'company' : 'companies'} imported`);
    } else {
      parts.push('No new companies imported');
    }
    if (result.duplicates > 0) parts.push(`${result.duplicates} ${result.duplicates === 1 ? 'duplicate' : 'duplicates'} skipped`);
    if (result.skipped > 0) parts.push(`${result.skipped} invalid ${result.skipped === 1 ? 'row' : 'rows'} skipped`);
    el.classList.add('success');
    el.textContent = parts.join(', ') + '.';
  }

  // Auto-clear after 5 seconds so the message doesn't clutter the UI
  setTimeout(() => {
    el.setAttribute('hidden', '');
    el.className = 'import-feedback';
  }, 5000);
}

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
  // Hide the update-cards section — a not-yet-saved company has nothing to attach cards to.
  const section = document.getElementById('update-cards-section');
  if (section) section.classList.add('hidden');
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
  // Status is derived from update cards (JST-64), not edited in the modal.
  document.getElementById('company-role').value = company.roleApplied || '';

  // Update cards (JST-63) are only available when editing a saved company, since the
  // company must exist in the array for the CRUD handlers to target it by index.
  const section = document.getElementById('update-cards-section');
  if (section) {
    section.classList.remove('hidden');
    resetUpdateForm();
    renderUpdateCards(index);
  }

  document.getElementById('add-company-modal').classList.add('active');
  document.getElementById('company-name').focus();
}

function closeModal() {
  document.getElementById('add-company-modal').classList.remove('active');
  document.getElementById('add-company-form').reset();
  document.getElementById('modal-title').textContent = 'Add new company';
  document.getElementById('modal-submit-btn').textContent = 'Save company';
  document.getElementById('edit-index').value = '-1';
  // Collapse the inline update panel so it isn't left open the next time the modal opens.
  resetUpdateForm();
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
  // Status is derived from update cards (JST-64) and usefulInfo was migrated into update-card
  // notes (JST-65), so this editor only manages the role applied for.
  const role = document.getElementById(`role-${index}`).value.trim();
  company.roleApplied = role;
  company.lastUpdated = new Date().toISOString();
  saveCompanies(companies);
  renderCompanies();
}

// ─── Update card modal handlers (JST-63) ───────────────────────────────────────
// DOM glue between the modal's inline update panel and the addUpdateCard/editUpdateCard/
// deleteUpdateCard logic. The company being edited is identified by the #edit-index hidden
// field the company modal already maintains, so these handlers take only the card index.
// Exercised by Playwright (DOM), not Jest.

// currentCompanyIndex — the array index of the company the modal is currently editing.
// @returns {number}
function currentCompanyIndex() {
  return parseInt(document.getElementById('edit-index').value, 10);
}

// populateUpdateStatusOptions — fills the status <select> from UPDATE_STATUSES so the enum
// stays single-sourced in app.js. No-op once already populated.
function populateUpdateStatusOptions() {
  const select = document.getElementById('update-card-status');
  if (!select || select.options.length === UPDATE_STATUSES.length) return;
  select.innerHTML = UPDATE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('');
}

// renderUpdateCards — renders the update cards for the company at companyIndex into
// #update-cards-list. Free-text fields are escaped (escapeHtml); the date is formatted in
// UTC to match how it is stored (ISO midnight UTC) and avoid an off-by-one shift. Each card
// carries Edit/Delete buttons keyed by its index. Shows an empty state when there are none.
// @param {number} companyIndex
function renderUpdateCards(companyIndex) {
  const list = document.getElementById('update-cards-list');
  if (!list) return;
  const company = getCompanies()[companyIndex];
  const updates = (company && company.updates) || [];

  if (updates.length === 0) {
    list.innerHTML = '<p class="update-cards-empty">No updates yet.</p>';
    return;
  }

  list.innerHTML = updates.map((card, i) => {
    const statusClass = `update-status-${card.status.toLowerCase()}`;
    const dateLabel = card.date
      ? new Date(card.date).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '';
    return `
      <div class="update-card" data-card-index="${i}">
        <div class="update-card-header">
          <span class="update-status-badge ${statusClass}">${escapeHtml(card.status)}</span>
          ${card.role ? `<span class="update-card-role">${escapeHtml(card.role)}</span>` : ''}
          <span class="update-card-date">${escapeHtml(dateLabel)}</span>
        </div>
        ${card.notes ? `<p class="update-card-notes">${escapeHtml(card.notes)}</p>` : ''}
        <div class="update-card-actions">
          <button type="button" onclick="openEditUpdateForm(${i})">Edit</button>
          <button type="button" onclick="confirmDeleteUpdate(${i})">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// resetUpdateForm — hides and clears the inline add/edit panel and any error text.
function resetUpdateForm() {
  const panel = document.getElementById('update-card-form');
  if (!panel) return;
  panel.classList.add('hidden');
  document.getElementById('update-card-index').value = '-1';
  document.getElementById('update-card-role').value = '';
  document.getElementById('update-card-date').value = '';
  document.getElementById('update-card-notes').value = '';
  const status = document.getElementById('update-card-status');
  if (status && status.options.length) status.selectedIndex = 0;
  const err = document.getElementById('update-card-form-error');
  if (err) err.textContent = '';
}

// openAddUpdateForm — opens the inline panel in "add" mode (index -1), pre-filling the date
// with today so logging a fresh update needs no date edit in the common case.
function openAddUpdateForm() {
  populateUpdateStatusOptions();
  resetUpdateForm();
  document.getElementById('update-card-index').value = '-1';
  document.getElementById('update-card-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('update-card-form').classList.remove('hidden');
  document.getElementById('update-card-role').focus();
}

// openEditUpdateForm — opens the inline panel pre-filled with the card at cardIndex.
// @param {number} cardIndex
function openEditUpdateForm(cardIndex) {
  const company = getCompanies()[currentCompanyIndex()];
  if (!company || !company.updates[cardIndex]) return;
  const card = company.updates[cardIndex];
  populateUpdateStatusOptions();
  resetUpdateForm();
  document.getElementById('update-card-index').value = String(cardIndex);
  document.getElementById('update-card-role').value = card.role || '';
  document.getElementById('update-card-status').value = card.status;
  // ISO date → YYYY-MM-DD for the native date input.
  document.getElementById('update-card-date').value = card.date ? card.date.slice(0, 10) : '';
  document.getElementById('update-card-notes').value = card.notes || '';
  document.getElementById('update-card-form').classList.remove('hidden');
}

// submitUpdateForm — reads the inline panel and routes to editUpdateCard (index >= 0) or
// addUpdateCard (index -1). On success re-renders the list and collapses the panel; on
// validation failure shows the errors inline rather than discarding the user's input.
function submitUpdateForm() {
  const companyIndex = currentCompanyIndex();
  const cardIndex = parseInt(document.getElementById('update-card-index').value, 10);
  const dateValue = document.getElementById('update-card-date').value;
  const fields = {
    role: document.getElementById('update-card-role').value.trim(),
    status: document.getElementById('update-card-status').value,
    // YYYY-MM-DD → ISO at UTC midnight so the stored value and the UTC-formatted display
    // agree; omit when blank so createUpdateCard supplies the current timestamp.
    date: dateValue ? new Date(dateValue + 'T00:00:00.000Z').toISOString() : undefined,
    notes: document.getElementById('update-card-notes').value.trim()
  };

  const result = cardIndex >= 0
    ? editUpdateCard(companyIndex, cardIndex, fields)
    : addUpdateCard(companyIndex, fields);

  if (result.ok) {
    resetUpdateForm();
    renderUpdateCards(companyIndex);
  } else {
    const err = document.getElementById('update-card-form-error');
    if (err) err.textContent = result.errors.join('; ');
  }
}

// cancelUpdateForm — discards the inline panel without saving.
function cancelUpdateForm() {
  resetUpdateForm();
}

// confirmDeleteUpdate — deletes the card at cardIndex after a confirmation prompt, then
// re-renders the list.
// @param {number} cardIndex
function confirmDeleteUpdate(cardIndex) {
  if (!confirm('Delete this update?')) return;
  const companyIndex = currentCompanyIndex();
  const result = deleteUpdateCard(companyIndex, cardIndex);
  if (result.ok) renderUpdateCards(companyIndex);
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

// ─── handleSearch ─────────────────────────────────────────────────────────────
// Single entry point for the Search button, shared by both search modes.
// Reads the current mode toggle state and delegates to the appropriate function:
//   - 'single' mode → fetchJobs()  (searches by the entered keyword)
//   - 'all'    mode → fetchAllJobs() (iterates all titles in config)
//
// Keeping routing logic here (rather than inline onclick) makes it easy to test
// and means the HTML Search button has one stable onclick target regardless of mode.
async function handleSearch() {
  const selected = document.querySelector('input[name="search-mode"]:checked');
  const mode = selected ? selected.value : 'single';
  if (mode === 'all') {
    await fetchAllJobs();
  } else {
    await fetchJobs();
  }
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
  // Both modes share the single #fetch-btn — handleSearch() disables it before
  // delegating here, but we re-reference it to keep fetchAllJobs self-contained
  // and callable from tests or other entry points if needed.
  const btn = document.getElementById('fetch-btn');
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
      btn.disabled = false; btn.textContent = 'Search'; return;
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

  btn.disabled = false; btn.textContent = 'Search';
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
    fetchReedJobs,              // Exported so Jest unit tests can call it directly
    getSearchTitles,            // Exported so Jest unit tests can verify config-reading behaviour
    getSearchTitleCount,        // Exported so Jest unit tests can verify the count utility
    parseCSVToCompanies,        // Exported for unit testing CSV import logic
    parseJSONToCompanies,       // Exported for unit testing JSON import logic
    companiesToCSV,             // Exported for unit testing CSV serialisation
    companiesToJSON,            // Exported for unit testing JSON serialisation
    mergeImportedCompanies,     // Exported for unit testing merge/dedup logic
    UPDATE_STATUSES,            // Exported for unit testing the update-card status enum (JST-62)
    isValidUpdateStatus,        // Exported for unit testing status validation
    createUpdateCard,           // Exported for unit testing the update-card constructor
    validateUpdateCard,         // Exported for unit testing update-card validation
    normalizeCompany,           // Exported for unit testing the updates-array defaulting
    addUpdateCard,              // Exported for unit testing update-card add (JST-63)
    editUpdateCard,             // Exported for unit testing update-card edit
    deleteUpdateCard,           // Exported for unit testing update-card delete
    escapeHtml,                 // Exported for unit testing HTML escaping
    getLatestUpdateCard,        // Exported for unit testing latest-card selection (JST-64)
    deriveCompanyStatus,        // Exported for unit testing derived company status
    migrateCompanies,           // Exported for unit testing legacy-data migration (JST-65)
    runCompanyMigration,        // Exported for unit testing the on-load migration entry point
    filterUpdatesInRange,       // Exported for unit testing date-range filtering (JST-66)
    buildActivitySummary        // Exported for unit testing the Markdown activity summary
  };
}