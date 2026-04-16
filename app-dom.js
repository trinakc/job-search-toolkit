// DOM-related functions for app.js
// This file is loaded after app.js in the HTML

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
  // longer matches getCompanies() positions. All onclick handlers that write back
  // to localStorage (openEditCompanyModal, saveCompanyInfo, toggleExpand) receive
  // this real index so they operate on the correct entry regardless of sort/filter.
  const allCompanies = getCompanies();

  grid.innerHTML = companies.map((company) => {
    // findIndex by name — names are unique identifiers throughout the codebase
    const index = allCompanies.findIndex(c => c.name === company.name);
    return `
        <div class="company-card">
          <div class="company-name">${company.name}</div>
          <div class="company-meta">${company.location}</div>
          ${company.tags.length ? `<div class="tags">${company.tags.map(tag => tag === 'Strong fit' || tag === 'Cork-based' ? `<span class="tag green">${tag}</span>` : `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
          <div class="company-status status-${company.status || 'not-applied'}">${!company.status ? 'Not applied' : company.status === 'applied' ? 'Applied' : company.status === 'interviewing' ? 'Interviewing' : company.status === 'rejected' ? 'Rejected' : company.status === 'offer' ? 'Offer received' : 'Not applied'}</div>
          <a class="careers-link" onclick="trackCompanyClick('${company.name.replace(/'/g, "\\'")}', '${company.url}')" href="#">${company.url.replace('https://', '').split('/')[0]} →</a>
          ${company.lastClicked ? `<div class="company-last-clicked">Last visited: ${new Date(company.lastClicked).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : ''}
          <button class="expand-btn" onclick="toggleExpand(${index})">Show more info</button>
          <div class="company-expanded" id="expanded-${index}">
            <div class="expanded-field">
              <label for="status-${index}">Current status</label>
              <select id="status-${index}">
                <option value="" ${!company.status ? 'selected' : ''}>Not applied</option>
                <option value="applied" ${company.status === 'applied' ? 'selected' : ''}>Applied</option>
                <option value="interviewing" ${company.status === 'interviewing' ? 'selected' : ''}>Interviewing</option>
                <option value="rejected" ${company.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                <option value="offer" ${company.status === 'offer' ? 'selected' : ''}>Offer received</option>
              </select>
            </div>
            <div class="expanded-field">
              <label for="role-${index}">Role applied for</label>
              <input type="text" id="role-${index}" value="${company.roleApplied || ''}" placeholder="${(typeof API_CONFIG !== 'undefined' && API_CONFIG.ROLE_PLACEHOLDER) ? API_CONFIG.ROLE_PLACEHOLDER : 'e.g. Job Title'}">
            </div>
            <div class="expanded-field">
              <label for="info-${index}">Useful info discovered</label>
              <textarea id="info-${index}" placeholder="Notes about the company, contacts, etc.">${company.usefulInfo || ''}</textarea>
            </div>
            <button class="save-btn" onclick="saveCompanyInfo(${index})">Save changes</button>
            ${company.lastUpdated ? `<div class="company-last-updated">Last updated: ${new Date(company.lastUpdated).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : ''}
          </div>
          <button class="edit-btn" onclick="openEditCompanyModal(${index})">Edit</button>
          <button class="remove-btn" onclick="removeCompany('${company.name.replace(/'/g, "\\'")}')">Remove</button>
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

if (typeof window !== 'undefined' && document.getElementById('add-company-form')) {
  document.getElementById('add-company-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('company-name').value.trim();
    const location = document.getElementById('company-location').value.trim();
    const url = document.getElementById('company-url').value.trim();
    const tags = document.getElementById('company-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const status = document.getElementById('company-status').value || null;
    const role = document.getElementById('company-role').value.trim();
    const info = document.getElementById('company-info').value.trim();
    if (!name || !url) return;

    const companies = getCompanies();
    const editIndex = parseInt(document.getElementById('edit-index').value);

    if (editIndex >= 0 && editIndex < companies.length) {
      // Edit existing company: Update mutable fields while preserving tracking metadata
      // (lastClicked and lastUpdated are set by UI interactions, not form submission)
      const company = companies[editIndex];
      company.name = name;
      company.location = location;
      company.url = url;
      company.tags = tags;
      company.status = status;
      company.roleApplied = role;
      company.usefulInfo = info;
    } else {
      // Add new company: Initialize with null tracking metadata (set on first interaction)
      companies.push({ name, location, url, tags, lastClicked: null, status, roleApplied: role, usefulInfo: info, lastUpdated: null });
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

  updateTrackerNav();
  renderCompanies();
  renderAlerts();
}
