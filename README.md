# Job Search Toolkit

A single-file HTML job search dashboard built for Trina's active search for 
Delivery Manager, Engineering Manager, Technical Project Manager, and Scrum Master 
roles in Ireland (Dublin/Cork hybrid or remote).

## What it does

- **Live jobs** — searches Adzuna's Irish job database by role title and location, 
  highlights roles not seen before, supports single-title or broad "search all" mode
- **My tracker** — save interesting roles, track status (New → Applied → Interviewing → Skipped), 
  add notes. Persists in browser localStorage.
- **Target companies** — dynamic list of target employers with careers page links and tags. 
  Add and remove companies via the UI. Persists in browser localStorage.
- **Google alerts** — pre-built search strings to paste into google.com/alerts
- **Job fit scorer** — paste a job description, get an AI-powered fit analysis against 
  Trina's profile using the Anthropic API

## Tech

Single HTML file — no framework, no build step, no dependencies except:
- Google Fonts (DM Sans, DM Mono) — loaded from CDN
- Adzuna Jobs API — for live Irish job listings
- Anthropic API (claude-sonnet-4-20250514) — for job fit scoring

All state (tracker, companies, seen jobs) stored in browser localStorage.

## Known issues

- Adzuna API calls are blocked by CORS when opening the file directly from the 
  filesystem (`file://`). Run via a local server to use live search:

  python -m http.server 8000 --directory

  Then open `http://localhost:8000/job-search-toolkit.html`
- Adzuna Ireland (`/ie/`) endpoint access pending confirmation from Adzuna support

## Candidate profile (for AI scorer context)

- Delivery Manager / Engineering Manager based in County Limerick
- Background: QAD Inc — EM, Principal QA, Scrum Master, Product Owner
- Technical: AWS, Kubernetes, Docker, GitLab CI/CD, Bash, Python, Linux
- Certifications: CSM (Scrum Alliance 2021), PRINCE2 Foundation (PeopleCert 2026)
- Open to: Dublin/Cork hybrid (max 2 days), remote, or Limerick-based roles

## API keys

Stored directly in the HTML file (not committed to any public repository).
- Adzuna App ID and Key: in the `<script>` block at the bottom
- Anthropic API: handled via claude.ai infrastructure when running inside Claude artifacts

## Roadmap

- [ ] Last-checked date per company card
- [ ] Local server setup script for Windows
- [ ] Resolve Adzuna CORS / Ireland endpoint issue
- [ ] GitHub Pages hosting (would also fix CORS permanently)