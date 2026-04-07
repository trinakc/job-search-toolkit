// DOM-related functions for app.js
// This file is loaded after app.js in the HTML

function renderCompanies() {
  const companies = getCompanies();
  const grid = document.querySelector('.company-grid');
  grid.innerHTML = companies.map((company, index) => `
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
      `).join('');
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
      // Edit existing company
      const company = companies[editIndex];
      company.name = name;
      company.location = location;
      company.url = url;
      company.tags = tags;
      company.status = status;
      company.roleApplied = role;
      company.usefulInfo = info;
      // Don't reset lastClicked or lastUpdated
    } else {
      // Add new company
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

  // Handle feature flags - hide disabled features and show placeholders
  Object.keys(FEATURES).forEach(feature => {
    const navBtn = document.querySelector(`nav button[onclick*="show('${feature}'"]`);
    const panel = document.getElementById(feature);
    if (!isFeatureEnabled(feature)) {
      if (navBtn) navBtn.style.display = 'none'; // Hide nav button for disabled features
      if (panel) {
        // Replace panel content with "coming soon" message
        panel.innerHTML = `
          <h2>${panel.querySelector('h2') ? panel.querySelector('h2').textContent : feature}</h2>
          <p class="panel-desc">This feature is coming soon.</p>
        `;
      }
    }
  });

  // Set header info from config
  const headerInfo = document.getElementById('header-info');
  if (headerInfo) {
    headerInfo.textContent = (typeof API_CONFIG !== 'undefined' && API_CONFIG.HEADER_INFO) ? API_CONFIG.HEADER_INFO : 'Your Job Title · Your Location · Year';
  }

  updateTrackerNav();
  renderCompanies();
  renderAlerts();
}
