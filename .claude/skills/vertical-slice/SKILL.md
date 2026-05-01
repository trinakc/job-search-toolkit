# /vertical-slice — Vertical Slice Workflow Skill

Invoke this skill at the start of every JST ticket to enforce a plan-mode-first, TDD-driven implementation workflow.

## When to invoke

At the very beginning of any JST ticket — before reading any code or writing any file.

---

## Step 1 — Read the story

- If a story file exists at `stories/JST-xx-*.md`, read it in full before doing anything else.
- If not, confirm the ticket content is already present in the current conversation context (e.g. fetched from Notion).
- Extract and note: acceptance criteria, dependency map, scope constraints, out-of-scope list, and definition of done.

---

## Step 2 — Enter plan mode

You are now in plan mode. **Do not write any files.**
All actions until the plan is approved are read-only: explore, read, and think.

---

## Step 3 — Scope check

Before exploring anything, verify the stated scope:

- Ticket touches ≤ 3 files — if more, **stop and flag** for story splitting
- No changes to `src/` unless explicitly listed in the dependency map
- No new dependencies unless explicitly called out

If scope is larger than stated: stop, explain what you found, and ask the user to either confirm or split the story. Do not continue.

---

## Step 4 — Explore affected layers

Launch Explore agents (up to 3 in parallel) focused on the layers named in the ticket's dependency map.

Each agent should target one of:
- Existing function signatures and call sites in the affected files
- Test patterns in `app.test.js` or `tests/e2e/` that cover similar behaviour
- Feature flag patterns in the `FEATURES` object in `app.js` (if the ticket adds a flag)

Do not explore layers outside the dependency map — this is a vertical slice, not a horizontal audit.

---

## Step 5 — Map dependencies

After exploration, output a dependency tree in this format:

```
This ticket [short title]
  ├── depends on: [file or ticket] ✅/⚠️ [status note]
  └── unblocks: [what this enables]

Touches these layers:
  ├── [file path] ← [what changes and why]
  └── [file path] ← [what changes and why]
```

Flag any dependency that is missing, incomplete, or unclear with ⚠️ and note what needs resolving before implementation can start.

---

## Step 6 — Write and propose the plan

Write a plan file at the path specified by plan mode. The plan must include:

- **Context** — why this change is being made and what it achieves
- **Files to modify** — table of file path and action (create / modify)
- **Implementation steps** — ordered list, written at the level of "what to do in each file"
- **Verification** — exact commands to run and what to check

Call `ExitPlanMode` to request approval. Do not ask "Is this okay?" or similar in plain text — ExitPlanMode is the only approval mechanism.

---

## Step 7 — On plan approval: implement with TDD

Follow the TDD order from CLAUDE.md exactly:

1. Write failing Jest unit tests in `app.test.js` that describe expected behaviour in plain English
2. Implement the minimum code to make those tests pass
3. Add or update Playwright e2e tests in `tests/e2e/` for any UI behaviour
4. Run the full suite: `npm run lint:js && npm test && npm run test:e2e` — all must pass before committing

Only test logic functions with Jest. Test DOM behaviour with Playwright.

---

## Step 8 — Before committing

- Run `git diff` and read every changed line — be able to explain each one
- Commit message format: `JST-xx: short description of what changed`
- Include trailer: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- If ticket type is **Enhancement** or **Defect**: update `CHANGELOG.md` before committing
- If ticket type is **Task**: no changelog entry
- State the AI Involvement level (Generated / Assisted / None)

---

## Guardrails

- Never write a file before plan approval — non-negotiable
- Never skip the scope check in Step 3
- Never commit `config.js` under any circumstances
- If acceptance criteria are ambiguous, use `AskUserQuestion` before writing the plan
- If a dependency is missing or broken (⚠️), resolve it before proceeding to implementation
