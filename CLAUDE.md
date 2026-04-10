# CLAUDE.md — Claude Code Rules

## Project overview

Job Search Toolkit — a no-framework, no-build-step HTML/CSS/JS app for tracking job applications and discovering opportunities. Files are flat in the repo root. There is no `src/` directory.

Key files:
- `app.js` — application logic, state, API calls, feature flags
- `app-dom.js` — DOM rendering (loaded after app.js)
- `app.test.js` — Jest unit tests
- `job-search-toolkit.html` — markup and CSP configuration
- `job-search-toolkit.css` — all styles
- `config.js` — API keys and personal settings (gitignored, never committed)
- `config.template.js` — safe reference template for config.js
- `tests/e2e/smoke.spec.js` — Playwright UI tests
- `tests/e2e/company-sort-filter.spec.js` — Playwright UI tests

## Before writing any code

Always read the relevant existing files before starting. Understand the current patterns for:
- How features are structured and gated via the `FEATURES` object in `app.js`
- How `config.js` secrets are referenced
- How existing tests are written in `app.test.js` and the Playwright test files
- The Content Security Policy in `job-search-toolkit.html` — any new external API requires a `connect-src` update

Do not guess at structure. Read first.

## Test-driven development

Always write tests before implementation:

1. Write failing Jest unit tests in `app.test.js` that describe the expected behaviour in plain English
2. Implement the feature to make those tests pass
3. Add or update Playwright e2e tests in `tests/e2e/` for any UI behaviour
4. Run both test suites and confirm they pass before finishing

What to unit test:
- Functions that take input and return output
- Functions that read from or write to localStorage
- Functions containing conditional logic

Do not unit test functions that only manipulate the DOM — use Playwright for those.

If the tests don't clearly describe the expected behaviour in plain English, rewrite them before proceeding.

## Running tests

```bash
# Unit tests
npm test

# E2e tests (starts server automatically)
npm run test:e2e

# Lint
npm run lint:js

# Run all before committing
npm run lint:js && npm test && npm run test:e2e
```

All three must pass before a commit.

## Code comments

All code must be well commented. Comments should explain intent, not just restate what the code does.

Good comment:
```javascript
// Reed requires Basic Auth with the API key as username and an empty password.
// We base64-encode "key:" (note the trailing colon) as per the HTTP spec.
const credentials = btoa(`${apiKey}:`);
```

Bad comment:
```javascript
// Encode credentials
const credentials = btoa(`${apiKey}:`);
```

Specific expectations:
- Every function must have a comment explaining what it does, what it takes, and what it returns
- Non-obvious logic, edge case handling, and workarounds must be explained inline
- Any hardcoded value that isn't self-evident must have a comment explaining why it exists
- API integrations must include a comment referencing the relevant endpoint or documentation behaviour

Do not add comments to every line — comment what needs explaining, not what is already obvious from reading the code.

## Security rules — non-negotiable

- Never write a real API key, token, or secret into any committed file
- `config.js` is gitignored — it is the only place real keys belong
- `config.template.js` uses placeholder values only (e.g. `'your-key-here'`)
- `eslint-plugin-no-secrets` runs in CI and will catch high-entropy strings — do not attempt to work around it
- If a new external API is added, update the `connect-src` directive in the CSP meta tag in `job-search-toolkit.html`

## Changelog
 
After completing any ticket of type **Enhancement** or **Defect**, update `CHANGELOG.md` before committing.
 
The changelog format is:
 
```
## [YYYY-MM-DD]
 
### Enhancements
- JST-xx: Title
 
### Defects fixed
- JST-xx: Title
```
 
Rules:
- Read `CHANGELOG.md` before editing it — do not overwrite or reformat existing content
- Check if today's date heading already exists. If it does, add the new entry under the correct sub-heading (`### Enhancements` or `### Defects fixed`). If the sub-heading does not exist yet for that date, add it.
- If today's date heading does not exist, insert a new `## [YYYY-MM-DD]` block directly below the `---` separator, above all previous date entries
- A ticket may appear more than once in the changelog across different dates — this is expected
- Do not add duplicate entries within the same date block — check before inserting
- The ticket type will be stated in the prompt as either **Enhancement** or **Defect**. **Enhancement** maps to `### Enhancements`, **Defect** maps to `### Defects fixed`
- **Task** type tickets do not get a changelog entry
- Do not modify the `## Known issues` section

## Branching and commits

Branch naming:
```
feature/JST-xx-short-description
bugfix/JST-xx-short-description
hotfix/JST-xx-short-description
```

Commit message format:
```
JST-xx: short description of what changed
```

All AI-assisted commits must include the trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Before finishing any task

- Run `npm run lint:js` — no errors
- Run `npm test` — all Jest tests pass
- Run `npm run test:e2e` — all Playwright tests pass
- Run `git diff` — read every changed line and be able to explain it
- Do not commit anything you cannot explain — ask first if unsure
- Do not commit `config.js` under any circumstances

## AI involvement tracking

Every ticket on the Notion board has an AI Involvement field. When finishing a task, state which level applies:
- **Generated** — Claude Code wrote the bulk of the code
- **Assisted** — human-directed with AI support
- **None** — written without AI involvement