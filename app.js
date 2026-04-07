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
  jobs: true,      // Live job search - working
  tracker: true,   // Job tracker - working
  companies: true, // Target companies - working
  alerts: false,   // Google alerts - disabled due to hardcoded personal search strings
  scorer: false    // Job fit scorer - disabled due to hardcoded personal profile
};

// Function to check if a feature is enabled
// Returns false if the feature doesn't exist in FEATURES or is explicitly set to false
function isFeatureEnabled(feature) {
  return FEATURES.hasOwnProperty(feature) && FEATURES[feature] !== false; /* eslint-disable-line no-prototype-builtins */
}

const AID = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ADZUNA_APP_ID) ? API_CONFIG.ADZUNA_APP_ID : '';
const AKEY = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ADZUNA_APP_KEY) ? API_CONFIG.ADZUNA_APP_KEY : '';
const TRACKER_KEY = 'jst_tracker_v1';
const SEEN_KEY = 'jst_seen_v1';
const COMPANIES_KEY = 'jst_companies_v1';

const DEFAULT_COMPANIES = [
  { name: 'Datadog', location: 'Dublin · Observability SaaS', url: 'https://careers.datadoghq.com/all-jobs/?search=&location=Dublin%2C+Ireland', tags: ['Strong fit', 'EM', 'Delivery', 'DevOps'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'HubSpot', location: 'Dublin · Marketing SaaS', url: 'https://www.hubspot.com/careers/jobs#office=dublin', tags: ['EM', 'PM', 'Scrum'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Zendesk', location: 'Dublin · CX SaaS', url: 'https://jobs.zendesk.com/us/en/search-results?keywords=&location=Dublin%2C+Ireland', tags: ['PM', 'Delivery', 'Agile'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Teamwork.com', location: 'Cork · Project Mgmt SaaS', url: 'https://www.teamwork.com/careers/', tags: ['Cork-based', 'EM', 'Delivery'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Workhuman', location: 'Dublin · HR Tech SaaS', url: 'https://www.workhuman.com/company/careers/list/', tags: ['EM', 'Delivery'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Tines', location: 'Dublin · Security Automation', url: 'https://www.tines.com/careers', tags: ['EM', 'Delivery'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Phorest', location: 'Dublin · Vertical SaaS', url: 'https://www.phorest.com/careers/', tags: ['EM', 'Scrum'], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'AMCS Group', location: 'Limerick · Environment and Resources', url: 'https://www.amcsgroup.com/about/careers/', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Action Point (Viatel Technology Group)', location: 'Limerick · Digital transformation and cloud-based enterprise solutions', url: 'https://actionpoint.ie/careers/', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'HR Duo', location: 'Limerick · HR-tech company', url: 'https://hrduo.com/careers', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Deveire', location: 'Limerick · Bespoke digital solutions and CMS platforms', url: 'https://www.deveire.com/careers', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Dell Technologies', location: 'Limerick · Digital transformation, cybersecurity, and cloud software services', url: 'https://jobs.dell.com/en/location/limerick-jobs/375/2963597-7521315-2962943/4', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Jaguar Land Rover (Software Center)', location: 'Limerick · "Software Defined Vehicles," including cloud platforms, AI, and enterprise data management', url: 'https://www.jaguarlandrovercareers.com/content/Locations/Ireland/', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Advarra', location: 'Limerick · Provides workflow and compliance SaaS solutions for clinical research and life sciences', url: 'https://www.advarra.com/about/careers/', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'ACI Worldwide', location: 'Limerick · A global provider of real-time payments software and enterprise SaaS solutions for banks and retailers', url: 'https://www.aciworldwide.com/about-aci/careers', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Stats Perform', location: 'Limerick · An AI and data SaaS company providing deep sports analytics and enterprise data solutions to media and pro teams', url: 'https://www.statsperform.com/careers/', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'Elastic', location: 'Remote · Elasticsearch', url: 'https://jobs.elastic.co/jobs/country/ireland?size=n_20_n', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
  { name: 'RxSense', location: 'Dublin · Healthtech', url: 'https://job-boards.greenhouse.io/rxsense', tags: [], lastClicked: null, status: null, roleApplied: '', usefulInfo: '', lastUpdated: null },
];

function getTracker() { try { return JSON.parse(localStorage.getItem(TRACKER_KEY) || '{}'); } catch { return {}; } }
function saveTracker(d) { localStorage.setItem(TRACKER_KEY, JSON.stringify(d)); updateTrackerNav(); }
function getSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } }
function saveSeen(ids) { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); }

function getCompanies() {
  let companies = JSON.parse(localStorage.getItem(COMPANIES_KEY));
  if (!companies) {
    companies = DEFAULT_COMPANIES;
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
  }
  return companies;
}
function saveCompanies(companies) { localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies)); }

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

async function fetchJobs() {
  const role = document.getElementById('role-filter').value;
  const loc = document.getElementById('location-filter').value;
  const btn = document.getElementById('fetch-btn');
  const list = document.getElementById('jobs-list');
  btn.disabled = true; btn.textContent = 'Searching...';
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div>Fetching live jobs from Adzuna...</div>';

  const where = loc === 'ireland' ? 'ireland' : encodeURIComponent(loc);
  const url = `https://api.adzuna.com/v1/api/jobs/ie/search/1?app_id=${AID}&app_key=${AKEY}&results_per_page=20&what=${encodeURIComponent(role)}&where=${where}&content-type=application/json`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const jobs = data.results || [];

    const seen = getSeen();
    const newIds = jobs.map(j => j.id).filter(id => !seen.includes(id));
    saveSeen([...new Set([...seen, ...jobs.map(j => j.id)])]);

    document.getElementById('last-fetched').textContent =
      'Last fetched: ' + new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });

    if (!jobs.length) {
      list.innerHTML = '<div class="empty-state">No roles found. Try a different role type or location.</div>';
      btn.disabled = false; btn.textContent = 'Search'; return;
    }

    const tracker = getTracker();
    const newCount = newIds.length;
    const summary = `<div class="results-summary">Showing <span>${jobs.length}</span> roles${newCount > 0 ? ' &middot; <span style="color:var(--accent)">' + newCount + ' new since last search</span>' : ''}</div>`;

    const cards = jobs.map(job => {
      const isNew = newIds.includes(job.id);
      const isTracked = !!tracker[job.id];
      const company = job.company?.display_name || '';
      const location = job.location?.display_name || '';
      const salary = job.salary_min && job.salary_max
        ? ' &middot; \u20ac' + Math.round(job.salary_min / 1000) + 'k\u2013\u20ac' + Math.round(job.salary_max / 1000) + 'k'
        : '';
      const posted = job.created
        ? ' &middot; ' + new Date(job.created).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
        : '';
      const desc = job.description
        ? job.description.replace(/<[^>]+>/g, '').substring(0, 220) + '...'
        : '';
      const safeTitle = (job.title || '').replace(/'/g, "\\'");
      const safeCompany = company.replace(/'/g, "\\'");
      const safeUrl = (job.redirect_url || '').replace(/'/g, "\\'");

      return `<div class="job-card${isNew ? ' is-new' : ''}" id="jcard-${job.id}">
        <div class="job-header">
          <div class="job-title">${job.title}</div>
          ${isNew ? '<span class="new-badge">New</span>' : ''}
        </div>
        <div class="job-meta">${company}${location ? ' &middot; ' + location : ''}${salary}${posted}</div>
        <div class="job-desc">${desc}</div>
        <div class="job-actions">
          <a class="job-link" href="${job.redirect_url}" target="_blank">View role &rarr;</a>
          ${isTracked
          ? '<span class="tracked-label">Tracked</span>'
          : `<button class="track-btn" onclick="addToTracker('${job.id}','${safeTitle}','${safeCompany}','${safeUrl}')">+ Track</button>`
        }
        </div>
      </div>`;
    }).join('');

    list.innerHTML = summary + '<div class="jobs-list">' + cards + '</div>';
  } catch (e) {
    list.innerHTML = '<div class="empty-state" style="color:#B03A2E;">Error fetching jobs. Check your internet connection and try again.</div>';
  }
  btn.disabled = false; btn.textContent = 'Search';
}

async function fetchAllJobs() {
  const coreTitles = [
    'delivery manager',
    'engineering manager',
    'scrum master',
    'technical project manager',
    'programme manager',
    'agile coach',
    'release manager',
    'development manager'
  ];
  const loc = document.getElementById('location-filter').value;
  const btn = document.getElementById('fetch-all-btn');
  const list = document.getElementById('jobs-list');
  btn.disabled = true; btn.textContent = 'Searching...';
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div>Searching all titles — this may take a moment...</div>';

  const where = loc === 'ireland' ? 'ireland' : encodeURIComponent(loc);

  try {
    const requests = coreTitles.map(title =>
      fetch(`https://api.adzuna.com/v1/api/jobs/ie/search/1?app_id=${AID}&app_key=${AKEY}&results_per_page=10&what=${encodeURIComponent(title)}&where=${where}&content-type=application/json`)
        .then(r => r.json())
        .then(d => d.results || [])
        .catch(() => [])
    );

    const results = await Promise.all(requests);
    const seen = getSeen();
    const seenIds = new Set();
    const allJobs = [];

    results.flat().forEach(job => {
      if (!seenIds.has(job.id)) {
        seenIds.add(job.id);
        allJobs.push(job);
      }
    });

    allJobs.sort((a, b) => new Date(b.created) - new Date(a.created));

    const newIds = allJobs.map(j => j.id).filter(id => !seen.includes(id));
    saveSeen([...new Set([...seen, ...allJobs.map(j => j.id)])]);

    document.getElementById('last-fetched').textContent =
      'Last fetched: ' + new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });

    if (!allJobs.length) {
      list.innerHTML = '<div class="empty-state">No roles found.</div>';
      btn.disabled = false; btn.textContent = 'Search all titles'; return;
    }

    const tracker = getTracker();
    const newCount = newIds.length;
    const summary = `<div class="results-summary">Showing <span>${allJobs.length}</span> roles across all titles${newCount > 0 ? ' &middot; <span style="color:var(--accent)">' + newCount + ' new since last search</span>' : ''}</div>`;

    const cards = allJobs.map(job => {
      const isNew = newIds.includes(job.id);
      const isTracked = !!tracker[job.id];
      const company = job.company?.display_name || '';
      const location = job.location?.display_name || '';
      const salary = job.salary_min && job.salary_max
        ? ' &middot; \u20ac' + Math.round(job.salary_min / 1000) + 'k\u2013\u20ac' + Math.round(job.salary_max / 1000) + 'k'
        : '';
      const posted = job.created
        ? ' &middot; ' + new Date(job.created).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
        : '';
      const desc = job.description
        ? job.description.replace(/<[^>]+>/g, '').substring(0, 220) + '...'
        : '';
      const safeTitle = (job.title || '').replace(/'/g, "\\'");
      const safeCompany = company.replace(/'/g, "\\'");
      const safeUrl = (job.redirect_url || '').replace(/'/g, "\\'");

      return `<div class="job-card${isNew ? ' is-new' : ''}" id="jcard-${job.id}">
        <div class="job-header">
          <div class="job-title">${job.title}</div>
          ${isNew ? '<span class="new-badge">New</span>' : ''}
        </div>
        <div class="job-meta">${company}${location ? ' &middot; ' + location : ''}${salary}${posted}</div>
        <div class="job-desc">${desc}</div>
        <div class="job-actions">
          <a class="job-link" href="${job.redirect_url}" target="_blank">View role &rarr;</a>
          ${isTracked
          ? '<span class="tracked-label">Tracked</span>'
          : `<button class="track-btn" onclick="addToTracker('${job.id}','${safeTitle}','${safeCompany}','${safeUrl}')">+ Track</button>`
        }
        </div>
      </div>`;
    }).join('');

    list.innerHTML = summary + '<div class="jobs-list">' + cards + '</div>';
  } catch (e) {
    list.innerHTML = '<div class="empty-state" style="color:#B03A2E;">Error fetching jobs. Check your connection and try again.</div>';
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
            <div class="tracker-saved">Saved ${new Date(item.savedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
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
    result.innerHTML = '<div class="loading-state" style="color:#B03A2E;">Something went wrong — check your connection and try again.</div>';
  }
  btn.disabled = false; btn.textContent = 'Analyse fit';
}

if (typeof module !== 'undefined') {
  /* eslint-disable-next-line no-undef */
  module.exports = { getTracker, saveTracker, getSeen, saveSeen, getCompanies, saveCompanies, updateStatus, updateNote, isFeatureEnabled };
}