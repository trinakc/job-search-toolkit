// DOM-related functions for app.js
// This file is loaded after app.js in the HTML

// ─── initSearchModeToggle ─────────────────────────────────────────────────────
// Sets up the Live Jobs mode toggle. Called once on DOMContentLoaded.
//
// Responsibilities:
//   1. Populate the #role-suggestions <datalist> from API_CONFIG.SEARCH_TITLES so
//      the role text input offers autocomplete suggestions.
//   2. Update the "All configured titles" label to show the count from config, e.g.
//      "All configured titles (8)".
//   3. Wire up the radio change event so switching modes shows/hides the role input.
//   4. Apply the correct initial visibility state based on the pre-checked radio.
function initSearchModeToggle() {
  const singleRadio    = document.getElementById('mode-single');
  const allRadio       = document.getElementById('mode-all');
  const roleInputWrap  = document.getElementById('role-input-wrap');
  const allTitlesLabel = document.getElementById('all-titles-label');
  const datalist       = document.getElementById('role-suggestions');

  // Guard: if any element is missing (e.g. in a test harness), do nothing
  if (!singleRadio || !allRadio || !roleInputWrap || !allTitlesLabel || !datalist) return;

  // Populate datalist with SEARCH_TITLES from config — gives the text input
  // autocomplete suggestions without restricting it to those values
  const titles = (typeof API_CONFIG !== 'undefined' && Array.isArray(API_CONFIG.SEARCH_TITLES))
    ? API_CONFIG.SEARCH_TITLES
    : [];
  datalist.innerHTML = titles.map(t => `<option value="${t}">`).join('');

  // Update the label to show the title count: "All configured titles (8)"
  const count = getSearchTitleCount();
  allTitlesLabel.textContent = count > 0
    ? `All configured titles (${count})`
    : 'All configured titles (none configured)';

  // Toggle role input visibility when the mode changes.
  // Single mode: role input visible. All-titles mode: role input hidden.
  function applyModeVisibility() {
    const isAll = allRadio.checked;
    roleInputWrap.style.display = isAll ? 'none' : '';
  }

  singleRadio.addEventListener('change', applyModeVisibility);
  allRadio.addEventListener('change', applyModeVisibility);

  // Apply initial state — the HTML defaults to single mode (checked), so the
  // role input is visible on load. Call once to ensure JS-driven state matches HTML.
  applyModeVisibility();
}

// ─── renderCompanyTagOptions ──────────────────────────────────────────────────
// Populates the tag filter <select> with every unique tag across all companies.
// Called once when the companies panel first loads.
// Preserves the currently selected value so re-renders don't reset the control.
function renderCompanyTagOptions() {
  const select = document.getElementById('company-tag-filter');
  if (!select) return;

  const currentValue = select.value;

  // Collect every unique tag from all companies, sorted alphabetically
  const allTags = [...new Set(
    getCompanies().flatMap(c => c.tags)
  )].sort((a, b) => a.localeCompare(b));

  // Rebuild options — "All tags" placeholder plus one option per unique tag
  select.innerHTML = '<option value="">All tags</option>' +
    allTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

  // Restore previously selected value if it still exists in the new option list
  if (currentValue) select.value = currentValue;
}

// ─── resetCompanyControls ─────────────────────────────────────────────────────
// Resets all three sort/filter controls to their defaults and re-renders.
// Called by the Reset button in the company panel.
function resetCompanyControls() {
  const sort       = document.getElementById('company-sort');
  const tagFilter  = document.getElementById('company-tag-filter');
  const dateFilter = document.getElementById('company-date-filter');
  if (sort)       sort.value       = 'alpha-asc';
  if (tagFilter)  tagFilter.value  = '';
  if (dateFilter) dateFilter.value = '';
  renderCompanies();
}

// ─── renderCompanies ──────────────────────────────────────────────────────────
// Reads the current sort/filter control values, applies them to the company list,
// and re-renders the grid. Called on page load and whenever a control changes.
function renderCompanies() {
  // Read current control values — default to safe values if controls don't exist
  // (e.g. during initial page load before the DOM is fully ready)
  const sortKey    = (document.getElementById('company-sort')        || {}).value || 'alpha-asc';
  const tagFilter  = (document.getElementById('company-tag-filter')  || {}).value || '';
  const daysAgo    = (document.getElementById('company-date-filter') || {}).value || '';

  // Build the display list: filter first, then sort the filtered set
  const filtered = filterCompanies(getCompanies(), {
    tag:     tagFilter  || undefined,
    daysAgo: daysAgo    ? parseInt(daysAgo, 10) : undefined,
  });
  const companies = sortCompanies(filtered, sortKey);

  // Populate tag options from the full unfiltered list (so available tags don't
  // shrink as a tag filter is applied — that would make it impossible to change)
  renderCompanyTagOptions();

  // Update the visible count so the user knows how many cards are showing
  const countEl = document.getElementById('company-count');
  if (countEl) {
    const total = getCompanies().length;
    countEl.textContent = companies.length === total
      ? ''
      : `Showing ${companies.length} of ${total}`;
  }

  const grid = document.querySelector('.company-grid');
  // Show an empty state message if filters match nothing, rather than a blank grid
  if (!companies.length) {
    grid.innerHTML = '<div class="empty-state">No companies match the current filters.</div>';
    return;
  }

  // Look up the real index of each company in the full unfiltered array.
  // The rendered `companies` array is filtered/sorted, so its map position no
  // longer matches getCompanies() positions. The onclick handlers that write back
  // to localStorage (openEditCompanyModal, removeCompany) receive this real index/name
  // so they operate on the correct entry regardless of sort/filter.
  const allCompanies = getCompanies();

  grid.innerHTML = companies.map((company) => {
    // findIndex by name — names are unique identifiers throughout the codebase
    const index = allCompanies.findIndex(c => c.name === company.name);
    return `
        <div class="company-card">
          <div class="company-name">${company.name}</div>
          <div class="company-meta">${company.location}</div>
          ${company.tags.length ? `<div class="tags">${company.tags.map(tag => tag === 'Strong fit' || tag === 'Cork-based' ? `<span class="tag green">${tag}</span>` : `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
          ${(() => {
            // Status is derived from the most recent update card (JST-64). No updates → neutral state.
            const derived = deriveCompanyStatus(company);
            return derived
              ? `<div class="company-status update-status-${derived.toLowerCase()}">${derived}</div>`
              : `<div class="company-status status-not-applied">No updates</div>`;
          })()}
          <a class="careers-link" onclick="trackCompanyClick('${company.name.replace(/'/g, "\\'")}', '${company.url}')" href="#">${company.url.replace('https://', '').split('/')[0]} →</a>
          ${company.lastClicked ? `<div class="company-last-clicked">Last visited: ${new Date(company.lastClicked).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : ''}
          <!-- "Show more info" expander removed (JST-67): its only field was the company-level role,
               which now lives on update cards. Status is derived (JST-64) and useful-info was migrated
               into cards (JST-65), so all company detail is now edited via the modal's update log. -->
          ${pendingCompanyRemoval === company.name
            // Inline confirmation (JST-75): clicking Remove swaps the card's buttons for this
            // two-step prompt instead of deleting immediately. "Yes, remove" performs the actual
            // deletion; "Cancel" aborts and restores the normal buttons, leaving all data intact.
            ? `<div class="remove-confirm">
                 <span class="remove-confirm-text">Remove this company?</span>
                 <button class="remove-confirm-yes" onclick="removeCompany('${company.name.replace(/'/g, "\\'")}')">Yes, remove</button>
                 <button class="remove-confirm-cancel" onclick="cancelRemoveCompany()">Cancel</button>
               </div>`
            // Default state: Remove calls requestRemoveCompany so a confirmation is shown first.
            : `<button class="edit-btn" onclick="openEditCompanyModal(${index})">Edit</button>
               <button class="remove-btn" onclick="requestRemoveCompany('${company.name.replace(/'/g, "\\'")}')">Remove</button>`}
        </div>
      `;
  }).join('');
}

function renderAlerts() {
  const alertsContainer = document.querySelector('.alert-list');
  if (!alertsContainer) return;
  // Load alert strings from config, or show placeholder if none configured
  const alertStrings = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ALERT_STRINGS) ? API_CONFIG.ALERT_STRINGS : [];
  if (!alertStrings.length) {
    alertsContainer.innerHTML = '<p>Add your Google alert search strings in config.js</p>';
    return;
  }
  // Render each alert as a card with copy button
  alertsContainer.innerHTML = alertStrings.map(alert => `
    <div class="alert-card">
      <div class="alert-name">${alert.name}</div>
      <div class="alert-string">${alert.string}</div>
      <button class="copy-btn" onclick="copyAlert(this,'${alert.string.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">Copy string</button>
    </div>
  `).join('');
}

// Holds the most recently generated activity summary so the Copy button copies the exact
// text shown without re-deriving it. Reset to '' whenever the panel can't produce output.
let lastActivitySummary = '';

// renderActivitySummary — reads the From/To date inputs, builds the Markdown summary from all
// companies' update cards in range (buildActivitySummary in app.js), and writes it into the
// output box. Uses textContent (not innerHTML) so the Markdown shows literally and any free-text
// notes can't inject markup. Both dates are required; a missing one shows an inline hint instead.
function renderActivitySummary() {
  const start = document.getElementById('summary-start').value;
  const end = document.getElementById('summary-end').value;
  const result = document.getElementById('summary-result');
  const output = document.getElementById('summary-output');

  // Guard: both bounds are needed to form a range. Show the box with a hint rather than
  // generating against an open-ended range.
  if (!start || !end) {
    lastActivitySummary = '';
    output.textContent = 'Please choose both a start and end date.';
    result.hidden = false;
    return;
  }

  lastActivitySummary = buildActivitySummary(getCompanies(), start, end);
  output.textContent = lastActivitySummary;
  result.hidden = false;
}

// copyActivitySummary — copies the last generated summary to the clipboard, mirroring the
// copyAlert feedback pattern: swap the label to "Copied!" with the .copied class, then restore
// after 2s. No-op when there is no generated summary (e.g. the date-hint state).
// @param {HTMLElement} btn — the Copy button, used for the transient feedback state
function copyActivitySummary(btn) {
  if (!lastActivitySummary) return;
  navigator.clipboard.writeText(lastActivitySummary).then(() => {
    btn.textContent = 'Copied!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy summary'; btn.classList.remove('copied'); }, 2000);
  });
}

if (typeof window !== 'undefined' && document.getElementById('add-company-form')) {
  // One-time legacy-data migration (JST-65): fold any pre-existing usefulInfo/status into an
  // update card and drop the old fields. Runs before the first render so the grid reflects it.
  runCompanyMigration();

  document.getElementById('add-company-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('company-name').value.trim();
    const location = document.getElementById('company-location').value.trim();
    const url = document.getElementById('company-url').value.trim();
    const tags = document.getElementById('company-tags').value.split(',').map(t => t.trim()).filter(t => t);
    if (!name || !url) return;

    const companies = getCompanies();
    const editIndex = parseInt(document.getElementById('edit-index').value);

    if (editIndex >= 0 && editIndex < companies.length) {
      // Edit existing company: Update mutable fields while preserving tracking metadata
      // (lastClicked and lastUpdated are set by UI interactions, not form submission).
      // status, usefulInfo and updates are intentionally left untouched here — status is now
      // derived from update cards (JST-64), usefulInfo was migrated into update cards (JST-65), and
      // update cards persist via their own handlers. Role lives on update cards too (JST-67).
      const company = companies[editIndex];
      company.name = name;
      company.location = location;
      company.url = url;
      company.tags = tags;
    } else {
      // Add new company: Initialize with null tracking metadata (set on first interaction).
      // Legacy company-level status/usefulInfo/role fields are no longer part of new companies
      // — that data now lives on update cards (JST-64/65/67). JST-72: optionally seed one update
      // card from the initial-update section. buildInitialUpdates returns [] unless the section
      // is expanded with a status chosen, so an unused/collapsed section yields updates: [].
      const initialDate = document.getElementById('initial-update-date').value;
      const updates = buildInitialUpdates({
        expanded: !document.getElementById('initial-update-fields').classList.contains('hidden'),
        role: document.getElementById('initial-update-role').value.trim(),
        status: document.getElementById('initial-update-status').value,
        // YYYY-MM-DD → ISO at UTC midnight, matching submitUpdateForm; omitted lets the card default to now.
        date: initialDate ? new Date(initialDate + 'T00:00:00.000Z').toISOString() : undefined,
        notes: document.getElementById('initial-update-notes').value.trim()
      });
      companies.push({ name, location, url, tags, lastClicked: null, lastUpdated: null, updates });
    }

    saveCompanies(companies);
    renderCompanies();
    closeModal();
  });

  document.getElementById('add-company-modal').addEventListener('click', (e) => {
    if (e.target.id === 'add-company-modal') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('add-company-modal').classList.contains('active')) closeModal();
  });

  // Activity summary (JST-66): default the range to the last 7 days so the panel is usable
  // for a weekly review without first picking dates. slice(0,10) yields the YYYY-MM-DD the
  // native date inputs expect; we go via UTC to match how update-card dates are stored.
  const summaryStart = document.getElementById('summary-start');
  const summaryEnd = document.getElementById('summary-end');
  if (summaryStart && summaryEnd) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    summaryEnd.value = today.toISOString().slice(0, 10);
    summaryStart.value = weekAgo.toISOString().slice(0, 10);
  }

  // Feature flag initialization: Hide UI elements for disabled features
  // This keeps the app flexible—disabled features remain in HTML but are invisible
  // Enable features by toggling FEATURES object in app.js; no DOM changes needed
  Object.keys(FEATURES).forEach(feature => {
    const navBtn = document.querySelector(`nav button[onclick*="show('${feature}'"]`);
    const panel = document.getElementById(feature);
    if (!isFeatureEnabled(feature)) {
      if (navBtn) navBtn.style.display = 'none';
      if (panel) panel.style.display = 'none';
    }
  });

  // Initialize landing page: Use function-driven default tab based on enabled features
  // (not hardcoded "active" class) to ensure the UI always reflects feature flags
  const defaultTab = getDefaultTab();
  const defaultButton = document.querySelector(`nav button[onclick*="show('${defaultTab}'"]`);
  if (defaultButton) {
    show(defaultTab, defaultButton);
  }

  // Set header info from config
  const headerInfo = document.getElementById('header-info');
  if (headerInfo) {
    headerInfo.textContent = (typeof API_CONFIG !== 'undefined' && API_CONFIG.HEADER_INFO) ? API_CONFIG.HEADER_INFO : 'Your Job Title · Your Location · Year';
  }

  // Set the role-filter placeholder from config so it reflects the user's typical search terms.
  // Falls back to the HTML default if config is absent (e.g. in CI or fresh setup).
  const roleFilter = document.getElementById('role-filter');
  if (roleFilter && typeof API_CONFIG !== 'undefined' && API_CONFIG.ROLE_PLACEHOLDER) {
    roleFilter.placeholder = API_CONFIG.ROLE_PLACEHOLDER;
  }

  initSearchModeToggle();
  updateTrackerNav();
  renderCompanies();
  renderAlerts();
}
