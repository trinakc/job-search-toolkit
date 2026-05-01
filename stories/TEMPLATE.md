# [TICKET ID]: [Ticket title]

## As a / I want / So that

**As a** [role — e.g. developer, job seeker using the app]
**I want** [goal — one sentence, outcome-focused]
**So that** [benefit — the value delivered]

---

## Dependency Map

```javascript
This ticket [[short title]]
  ├── depends on: [file or ticket] ✅/⚠️ [exists and ready / missing or incomplete]
  ├── depends on: [file or ticket] ✅/⚠️ [status note]
  └── unblocks: [what this ticket enables next]

Touches these layers:
  ├── [file path] ← [what changes and why]
  ├── [file path] ← [what changes and why]
  └── [file path] ← [what changes and why — or: DO NOT TOUCH]
```

---

## Scope Constraints

> Claude: do not write any code until a plan is approved (plan mode).

- [Specific constraint — e.g. "max 3 files modified"]
- [Specific constraint — e.g. "no changes to app.test.js structure"]
- If scope seems larger than described, **stop and flag** — story needs splitting
- No new dependencies unless explicitly listed above

---

## Acceptance Criteria

- [ ] **Given** [the starting state or context]
      **When** [the action or trigger]
      **Then** [the observable, verifiable outcome]

- [ ] **Given** [the starting state or context]
      **When** [the action or trigger]
      **Then** [the observable, verifiable outcome]

- [ ] **Given** [the starting state or context]
      **When** [the action or trigger]
      **Then** [the observable, verifiable outcome]

---

## Coding Standards

- [Standard specific to this ticket — e.g. "feature must be gated behind a FEATURES flag"]
- [Standard specific to this ticket — e.g. "no hardcoded strings — add to config.template.js"]
- Follow all standing rules in CLAUDE.md (comments, security, tests, changelog)

---

## Out of Scope

- [Related thing that is explicitly excluded — be specific to prevent scope creep]
- [Related thing that is explicitly excluded]
- Backfilling or refactoring code outside the dependency map

---

## Definition of Done

- [ ] Plan approved in plan mode before any files were written
- [ ] All acceptance criteria met and manually verified
- [ ] `npm run lint:js && npm test && npm run test:e2e` all pass
- [ ] Changelog updated (Enhancement or Defect tickets only — not Task)
- [ ] PR description references this ticket and states what changed and why

**Size:** [XS / S / M / L]   **Priority:** [Low / Medium / High]
