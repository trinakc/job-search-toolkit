# Job Search Toolkit

<!-- CI badge: reflects the last run of the full CI pipeline (lint, Jest, Playwright)
     against the main branch. Powered by GitHub Actions — updates automatically on every push.
     Badge URL format: https://github.com/<owner>/<repo>/actions/workflows/<filename>/badge.svg -->
[![CI](https://github.com/trinakc/job-search-toolkit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/trinakc/job-search-toolkit/actions/workflows/ci.yml)

A customizable HTML job search dashboard for tracking applications, discovering opportunities, and analyzing job fit.

## Table of Contents

- [Why I Built This the Way I Did](#why-i-built-this-the-way-i-did)
  - [People First](#people-first)
  - [The Prompt is the Requirement](#the-prompt-is-the-requirement)
  - [Quality](#quality)
  - [Governance and Guardrails](#governance-and-guardrails)
  - [Does It Work?](#does-it-work)
  - [Known Limitations](#known-limitations)
  - [References](#references)
- [Feature status](#feature-status)
- [What it does](#what-it-does)
- [Tech](#tech)
- [Setup](#setup)
  - [Get API keys](#get-api-keys)
  - [Configure locally](#configure-locally)
  - [Run locally](#run-locally)
- [Known issues](#known-issues)
- [Configuration](#configuration)
- [Security](#security)
- [Testing](#testing)
- [CI](#ci)
- [Working with Claude Code](#working-with-claude-code)
- [Commits and branching](#commits-and-branching)
- [AI involvement tracking](#ai-involvement-tracking)
- [Before committing](#before-committing)

## Why I Built This the Way I Did

The idea for this project came from a real user need, mine. Job searching is an imprecise, unscientific process where lots of effort and thought does not guarantee results, which is difficult for me to accept. Beyond the practical problem, I needed to build something tangible: something to achieve and point to, as a counterweight to the toll that rejections and unanswered applications take on you.

I also wanted to do something real with AI rather than just observe it from the sidelines. I'll admit I've been slow to "go full AI", sitting back and watching the world change around me. The QA instinct in me will always want to question things and find the flaws. But I reached a point where I needed to jump in, to see it in action and form my own view of how I want to work with it.

The key takeaway from the [*What is Generative AI*](https://www.linkedin.com/learning/what-is-generative-ai/generative-ai-is-a-tool-in-service-of-humanity) course I completed was that AI should be people-centred. I wanted to build a concrete bank of examples and challenges that either proves or tests that theory in practice.

Reading about the pitfalls of AI in development — [*Debt Behind the AI Boom*](https://arxiv.org/abs/2603.28592) and [*How AI-Generated Code Accelerates Technical Debt*](https://leaddev.com/software-quality/how-ai-generated-code-accelerates-technical-debt), I also wanted to explore how a project could actively safeguard against those limitations, not just acknowledge them.

That led me to a set of principles I think matter.

---

### People First

The user comes first, every feature should add value for a real person with a real need. AI is a collaborator, not a decision-maker; human judgement stays in the loop at every step.

---

### The Prompt is the Requirement

The quality of what Claude Code produces is directly proportional to the clarity of what the human asks for. Writing a good prompt demands the same discipline as writing a good requirement: who needs it, what it should do, and what "done" looks like. That clarity doesn't come from the AI, it comes from the person who understands the user, the problem, and the constraints. Prompt engineering, at its core, is requirements engineering by another name. And requirements engineering has always been the hardest, most human part of building software.

This is probably the most challenging and most important aspect of working effectively with AI. I'm actively upskilling in this area using [Anthropic's Prompt Engineering documentation](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) as a primary reference.

---

### Quality

Testing is not a phase at the end, it is embedded from requirements through to release. This is the core of both Test-Driven Development and the shift-left philosophy, and it comes directly from a QA background that has always treated quality as a shared responsibility, not a handoff.

- **Test-Driven Development:** write and agree the tests first, driven from customer requirements, before implementing anything. The [2025 DORA report](https://cloud.google.com/discover/how-test-driven-development-amplifies-ai-success) found that AI acts as an amplifier of existing good practices, which means TDD is more critical in an AI-assisted workflow, not less.
- **Shift left, always:** quality thinking starts at requirements, not at code review. [IBM describe shift-left well](https://www.ibm.com/think/topics/shift-left-testing): QA specialists involved from discovery and requirements gathering produce better outcomes and more resilient architecture. There was no separate testing phase here.

---

### Governance and Guardrails

Speed is the most seductive thing about AI-assisted development. That's where the pitfalls are most dangerous. The vulnerabilities that can be introduced are what scares me the most. This is a risk we need to accept and govern against.

To do this we create non-negotiable security, performance and quality gates. They need to be constantly reviewed, updated and keeping up with a changing world.

Governance needs to be thought about and applied early, not as an afterthought.

---

### Does It Work?

The initial results are in. The user (me) is happy. The engineering/delivery manager (also me) is confident in the quality. There is very little manual testing needed to release because of the upfront investment in unit tests and UI tests.

The next question, how to measure whether these principles held up systematically, is the next item on the research list.

---

### Known Limitations

This project was built to a deliberate scope. The following are known gaps, not oversights:

- **Performance** — no benchmarking or load testing has been done; this is a single-user local tool and performance has not been a priority
- **Test coverage** — UI smoke tests cover happy paths; edge cases and error states are not fully covered by automation yet
- **Adzuna CORS issue** — live search is pending resolution of the Ireland API endpoint, which limits the tracker functionality
- **Single-user only** — localStorage means no portability across devices or browsers; not designed for multi-user use
- **No accessibility audit** — not yet tested with screen readers or assessed against WCAG standards
- **AI involvement is self-reported** — the Notion tracking of Generated / Assisted / None is best-effort, not automated

---

### References

### People First
- [Human-Centric AI and the Future of Work — World Economic Forum](https://www.weforum.org/stories/2025/09/human-centric-ai-shape-the-future-of-work/)
- [Stanford Human-Centered AI Institute](https://hai.stanford.edu/)
- [Human at the Center: A Framework for Human-Driven AI Development — AI Magazine / Wiley](https://onlinelibrary.wiley.com/doi/full/10.1002/aaai.70043)

### The Prompt is the Requirement
- [Prompt Engineering Overview — Anthropic Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [The Prompt Engineering Playbook for Programmers — Addy Osmani](https://addyo.substack.com/p/the-prompt-engineering-playbook-for)
- [Best Practices for AI-Assisted Coding — Axur Engineering](https://engineering.axur.com/2025/05/09/best-practices-for-ai-assisted-coding.html)

### Quality
- [TDD and AI: Quality in the DORA Report — Google Cloud](https://cloud.google.com/discover/how-test-driven-development-amplifies-ai-success)
- [Why TDD Works So Well in AI-Assisted Programming — Codemanship](https://codemanship.wordpress.com/2026/01/09/why-does-test-driven-development-work-so-well-in-ai-assisted-programming/)
- [What is Shift-Left Testing? — IBM](https://www.ibm.com/think/topics/shift-left-testing)
- [Shift Left Testing: Turn Quality into a Growth Engine — Abstracta](https://abstracta.us/blog/devops/shift-left-testing/)
- [Requirements-Driven Development — Visure Solutions](https://visuresolutions.com/alm-guide/requirements-driven-development/)
- [Customer-Driven Development — Alex Bunardzic, Medium](https://medium.com/@alexbunardzic/customer-driven-development-2eb9b8e57380)

### Governance and Guardrails
- [How to Close the AI Governance Gap in Software Development — SecurityWeek](https://www.securityweek.com/how-to-close-the-ai-governance-gap-in-software-development/)
- [The Essential AI Governance Framework — Databricks](https://www.databricks.com/blog/practical-ai-governance-framework-enterprises)
- [The Time for AI Governance is Now — ISACA](https://www.isaca.org/resources/news-and-trends/industry-news/2025/the-time-for-ai-governance-is-now-key-considerations-and-guidelines-for-organizations)
- [As AI Speeds Up Development, Release Management is Becoming a Governance Issue — European Business Review](https://www.europeanbusinessreview.com/as-ai-speeds-up-development-release-management-is-becoming-a-governance-issue/)

### Pitfalls of AI in Development
- [Debt Behind the AI Boom: A Large-Scale Empirical Study — arXiv](https://arxiv.org/abs/2603.28592)
- [AI in Software Development: Productivity at the Cost of Code Quality? — DevOps.com](https://devops.com/ai-in-software-development-productivity-at-the-cost-of-code-quality-2/)
- [How AI-Generated Code Accelerates Technical Debt — LeadDev](https://leaddev.com/software-quality/how-ai-generated-code-accelerates-technical-debt)
- [The Hidden Costs of AI-Generated Code — Codebridge](https://www.codebridge.tech/articles/the-hidden-costs-of-ai-generated-software-why-it-works-isnt-enough)
- [AI-Generated Code Creates New Wave of Technical Debt — InfoQ](https://www.infoq.com/news/2025/11/ai-code-technical-debt/)


## Feature status

Current state of each panel — controlled via the `FEATURES` object in `app.js`:

| Feature | Status | Notes |
|---|---|---|
| Company tracker | ✅ Enabled | |
| Live jobs | ❌ Disabled | Pending Adzuna Ireland API confirmation |
| My tracker | ❌ Disabled | Hidden when live search is off — tracker is only populated via live search |
| Google alerts | ❌ Disabled | Contains hardcoded personal search strings |
| Job fit scorer | ❌ Disabled | Contains hardcoded personal profile |

## What it does

- **Live jobs** — searches job databases by role title and location, 
  highlights roles not seen before, supports single-title or broad "search all" mode.
  (This feature is currently disabled by default via the app feature flag until live search is stable.)
- **My tracker** — save interesting roles, track status (New → Applied → Interviewing → Skipped), 
  add notes. Persists in browser localStorage. Requires live search to be enabled.
- **Target companies** — dynamic list of target employers with careers page links and tags. 
  Add, edit, and remove companies via the UI. Status badges show application progress at a glance. 
  Click tracking records last visit date. Expandable application tracking: current status, role applied for, 
  useful company info, with last updated timestamps. Persists in browser localStorage.
- **Google alerts** — pre-built search strings to paste into google.com/alerts
- **Job fit scorer** — paste a job description, get an AI-powered fit analysis against 
  your configured profile using the Anthropic API

## Tech

No framework, no build step. The app is split across a small number of files:

- `job-search-toolkit.html` — markup and structure
- `job-search-toolkit.css` — all styles
- `app.js` — application logic (state, localStorage, API calls, feature flags)
- `app-dom.js` — DOM rendering functions (loaded after app.js)
- `config.js` — your personal API keys and profile settings (git-ignored, not committed)
- `config.template.js` — safe reference template for config.js

External dependencies:
- Google Fonts (DM Sans, DM Mono) — loaded from CDN
- Adzuna Jobs API — for live Irish job listings
- Anthropic API (claude-sonnet-4-20250514) — for job fit scoring

All state (tracker, companies, seen jobs) stored in browser localStorage.

## Setup

### Get API keys

1. **Adzuna Jobs API**: Register at https://developer.adzuna.com/ to get your App ID and Key.
2. **Anthropic API**: Required for the Job Fit Scorer. Get a key at https://console.anthropic.com/ and add it to `config.js`.

### Configure locally

1. Copy `config.template.js` to `config.js`:
   ```bash
   cp config.template.js config.js
   ```
2. Open `config.js` and add your API credentials and personal information (name, location, target roles, profile details, etc.).
3. `config.js` is git-ignored and will never be committed.

### Run locally

A local server is required to avoid CORS errors that occur when the file is opened directly via `file://`.

**Mac / Linux**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000/job-search-toolkit.html`

**Windows**

Double-click `start-server.bat` in the repo root, or run it from a terminal:
```bat
.\start-server.bat
```
The script opens the toolkit in your default browser and starts the Python server in one step. Python 3 must be installed and on your PATH.

## Known issues

- Adzuna Ireland (`/ie/`) endpoint access pending confirmation from Adzuna support
- Live Search is disabled by default via `FEATURES.jobs` in `app.js`; enable it once the Adzuna integration is stable.

## Configuration

The app is fully customizable through `config.js`. Key settings include:

- **API Keys**: Adzuna and Anthropic credentials
- **Personal Info**: Header text, location, target roles
- **Profile Details**: Background, skills, certifications for AI job fit analysis
- **Alert Strings**: Custom Google alert search queries
- **Feature Flags**: Enable/disable specific features (e.g., if APIs are unavailable)

See `config.template.js` for all available options.

## Security

**API keys and personal information** are stored in `config.js`, which is **git-ignored** and never committed to version control. A `config.template.js` is provided as a safe reference. This prevents accidental exposure of sensitive keys and personal data if the repo ever becomes public.

**Secret detection** — `eslint-plugin-no-secrets` runs as part of `npm run lint:js` and is enforced in CI, catching accidentally committed high-entropy tokens, keys, and secrets in JS and HTML files. This is a developer-time safeguard to help prevent accidental secret leaks in source code.

**Dependency vulnerabilities** — Dependabot is enabled via GitHub settings with alerts and automatic security updates active.

**GitHub security features** — Secret scanning is enabled at the repository level.

**Content Security Policy (CSP)** — Configured in the HTML `<meta>` tag to restrict resource loading and prevent injection attacks. It permits external resources only from trusted sources: Google Fonts (CSS and font files), Anthropic API, and Adzuna API.

## Testing

There are two test layers:

**Unit tests (Jest)** — cover pure functions in `app.js`: input/output logic, localStorage reads and writes, and conditional branching. Tests live in `app.test.js`.

```bash
npm test
```

**What to unit test:**
- Functions that take input and return output
- Functions that read from or write to localStorage
- Functions containing conditional logic

**What not to unit test:**
- Functions that only manipulate the DOM (use Playwright for those)

**UI smoke tests (Playwright)** — end-to-end tests that run against the real page in a browser. They verify that the page loads, navigation works, the company grid renders, the add-company modal saves correctly, and that localStorage data persists across page reloads. Tests live in `tests/e2e/smoke.spec.js` and run in Chromium.

```bash
npm run test:e2e
```

The server starts automatically before the tests and stops when they finish (configured via `webServer` in `playwright.config.js`). Requires Python 3 on your PATH.

Run both locally before committing:

```bash
npm test && npm run test:e2e
```

## CI

The CI pipeline runs automatically on every push to `main`, `feature/**`, `bugfix/**`, and `hotfix/**` branches, and on all pull requests to `main`. It runs three jobs in parallel:

| Job | Command | What it checks |
|---|---|---|
| `lint` | `npm run lint:js` | ESLint rules and secret detection on JS/HTML |
| `test` | `npm test` | Jest unit tests |
| `e2e` | `npm run test:e2e` | Playwright smoke tests in Chromium |

The badge at the top of this file reflects the last completed run against `main`. Green means all three jobs passed.

Configuration lives in `.github/workflows/ci.yml`.

## Working with Claude Code

When requesting a new feature, always include testing in the prompt:

> "Before writing any code, write the unit tests first that describe the expected behaviour. Then implement the feature to make those tests pass."

Read the tests before reading the implementation — if the tests don't clearly describe the expected behaviour in plain English, ask Claude Code to rewrite them before proceeding.

## Commits and branching

- Use Notion ticket numbers in commit messages: `JST-xx: description`
- Use feature branches: `feature/JST-xx-description`, `bugfix/JST-xx`, `hotfix/JST-xx`
- AI-generated commits include a `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer

## AI involvement tracking

Tracked on the [Notion project board](https://www.notion.so/3374e11bd2e780a39a39d08511a763fd?v=3374e11bd2e780e48d85000c4add0599):
- **Generated** — Claude Code wrote the bulk of the code
- **Assisted** — human-directed with AI support
- **None** — written without AI involvement

## Before committing

- Run `npm run lint:js` — confirm no errors
- Run `npm test` — confirm all Jest tests pass
- Run `npm run test:e2e` — confirm all Playwright smoke tests pass
- Run `git diff` — read every change and be able to explain what it does and why
- If you can't explain a change clearly, don't commit it — ask Claude Code to explain first
