# Job Search Toolkit

A customizable single-file HTML job search dashboard for tracking applications, discovering opportunities, and analyzing job fit.

## What it does

- **Live jobs** — searches job databases by role title and location, 
  highlights roles not seen before, supports single-title or broad "search all" mode.
  (This feature is currently disabled by default via the app feature flag until live search is stable.)
- **My tracker** — save interesting roles, track status (New → Applied → Interviewing → Skipped), 
  add notes. Persists in browser localStorage.
- **Target companies** — dynamic list of target employers with careers page links and tags. 
  Add, edit, and remove companies via the UI. Status badges show application progress at a glance. 
  Click tracking records last visit date. Expandable application tracking: current status, role applied for, 
  useful company info, with last updated timestamps. Persists in browser localStorage.
- **Google alerts** — pre-built search strings to paste into google.com/alerts
- **Job fit scorer** — paste a job description, get an AI-powered fit analysis against 
  your configured profile using the Anthropic API

## Tech

Single HTML file — no framework, no build step, no dependencies except:
- Google Fonts (DM Sans, DM Mono) — loaded from CDN
- Adzuna Jobs API — for live Irish job listings
- Anthropic API (claude-sonnet-4-20250514) — for job fit scoring

All state (tracker, companies, seen jobs) stored in browser localStorage.

## Setup

### Get API keys

1. **Adzuna Jobs API**: Register at https://developer.adzuna.com/ to get your App ID and Key.
2. **Anthropic API**: The Job Fit Scorer currently uses claude.ai web interface; no local key needed unless you add direct API access.

### Configure locally

1. Copy `config.template.js` to `config.js`:
   ```bash
   cp config.template.js config.js
   ```
2. Open `config.js` and add your API credentials and personal information (name, location, target roles, profile details, etc.).
3. `config.js` is git-ignored and will never be committed.

### Run locally

Start a local server to avoid CORS issues:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000/job-search-toolkit.html`

## Known issues

- Adzuna Ireland (`/ie/`) endpoint access pending confirmation from Adzuna support
- Live Search is disabled by default via `FEATURES.jobs` in `app.js`; enable it once the Adzuna integration is stable.
- CORS issues may occur if file is opened directly as `file://` (use local server instead)

## Configuration

The app is fully customizable through `config.js`. Key settings include:

- **API Keys**: Adzuna and Anthropic credentials
- **Personal Info**: Header text, location, target roles
- **Profile Details**: Background, skills, certifications for AI job fit analysis
- **Alert Strings**: Custom Google alert search queries
- **Feature Flags**: Enable/disable specific features (e.g., if APIs are unavailable)

See `config.template.js` for all available options.

## Security

API credentials and personal information are stored in `config.js`, which is **git-ignored** and never committed to version control. 
This prevents accidental exposure of sensitive keys and personal data if the repo ever becomes public.
The repository also uses `eslint-plugin-no-secrets` as part of `npm run lint:js` to catch high-entropy tokens, keys, and secrets in JS and HTML files. 
This is a safeguard to help prevent accidental secret leaks in source code.
Always keep `config.js` local and never commit it.

## Development practices

### Testing
All new features should have unit tests written before or alongside the implementation.
Tests live in `app.test.js` and are run with `npm test`.

**What to test:**
- Functions that take input and return output
- Functions that read from or write to localStorage
- Functions containing conditional logic

**What not to test:**
- Functions that only manipulate the DOM

Run tests locally before committing:

npm test

### Working with Claude Code
When requesting a new feature, always include testing in the prompt:

> "Before writing any code, write the unit tests first that describe the expected behaviour. Then implement the feature to make those tests pass."

Read the tests before reading the implementation — if the tests don't clearly describe the expected behaviour in plain English, ask Claude Code to rewrite them before proceeding.

### Commits and branching
- Use Notion ticket numbers in commit messages: `JST-xx: description`
- Tag AI-generated commits: `JST-xx: description [ai-assisted]`
- Use feature branches: `feature/JST-xx-description`, `bugfix/JST-xx`, `hotfix/JST-xx`

### AI involvement tracking
Tracked on the [Notion project board](https://www.notion.so/3374e11bd2e780a39a39d08511a763fd?v=3374e11bd2e780e48d85000c4add0599):
- **Generated** — Claude Code wrote the bulk of the code
- **Assisted** — human-directed with AI support
- **None** — written without AI involvement

### Before committing
- Run `npm run lint:js` — confirm no errors
- Run `npm test` — confirm all tests pass
- Run `git diff` — read every change and be able to explain what it does and why
- If you can't explain a change clearly, don't commit it — ask Claude Code to explain first
