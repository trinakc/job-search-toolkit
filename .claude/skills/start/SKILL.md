---
disable-model-invocation: true
---

# /start JST-{ID} — Kick off a vertical slice ticket

Fetches the Notion ticket, displays its context, moves it to In Progress, and enters
plan mode. The user must invoke this explicitly — never auto-run.

---

## Step 0 — Prerequisites check

Confirm a ticket ID was provided as an argument (e.g. `JST-58`). If not, stop:
> Usage: `/start JST-{ID}`

---

## Step 1 — Fetch the Notion ticket

1. Call `notion-search` with query `JST-{ID}` (workspace search, page_size 5).
2. If no result matches, stop:
   > JST-{ID} not found in Notion — status not changed.
3. Call `notion-fetch` on the matched page ID to load full content.

---

## Step 2 — Guard: ticket already started

Read the `Status` property from the fetched page.

- If status is `In Progress` or `Done`, warn the user:
  > JST-{ID} is already **{status}**. Continue anyway? (yes / no)

  Wait for confirmation. If the user says no, stop. If yes, continue.

---

## Step 3 — Display ticket context

Output a structured summary from the fetched page:

```
## JST-{ID}: {title}

### Acceptance Criteria
{acceptance criteria block}

### Scope Constraints
{scope constraints block}

### Dependency Map
{dependency map block}
```

Display this before updating Notion so the user sees the context first.

---

## Step 4 — Update Notion to In Progress

Call `notion-update-page`:
- `page_id`: the Notion page ID from Step 1
- `command`: `update_properties`
- `properties`: `{"Status": "In Progress"}`

If this fails, report the error in full and stop — do not enter plan mode.

On success, confirm:
> JST-{ID} marked as In Progress on Notion.

---

## Step 5 — Check branch and working tree

Stash any dirty tree, git checkout main && git pull, then git checkout -b <type>/JST-xx.

---

## Step 6 — Enter plan mode

Call `EnterPlanMode`. From here, the `/vertical-slice` workflow takes over to
explore affected layers, map dependencies, and write a plan for approval.
