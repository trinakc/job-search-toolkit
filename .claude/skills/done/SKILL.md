---
disable-model-invocation: true
---

# /done JST-{ID} — Wrap up a vertical slice

Commits staged changes, raises a draft PR, and moves the Notion ticket to In Review.
The user must invoke this explicitly — never auto-run.

---

## Step 0 — Prerequisites check

1. Confirm a ticket ID was provided as an argument (e.g. `JST-57`). If not, stop:
   > Usage: `/done JST-{ID}`

2. Run `git diff --cached --stat`. If the output is empty, stop:
   > Nothing staged — commit aborted. Stage your changes first.

Do not proceed past this step unless both checks pass.

---

## Step 1 — Propose a commit message

Run `git diff --cached` to review the staged changes, then propose a commit message:

```
JST-{ID}: {imperative title summarising the change}

Co-Authored-By: Claude <model> <noreply@anthropic.com>
```

Replace `<model>` with the specific model that assisted (e.g. the current Claude model and
version), so attribution stays accurate over time — matching the trailer rule in `CLAUDE.md`.

**Stop and wait for the user to approve or edit the message. Do not commit until they confirm.**

---

## Step 2 — Commit

Run the commit using a heredoc to preserve formatting exactly:

```bash
git commit -m "$(cat <<'EOF'
{approved message}
EOF
)"
```

If the commit fails for any reason (pre-commit hook, lint error, etc.), stop and report the
error in full. Do not proceed to Step 3 or Step 4.

---

## Step 3 — Raise a draft PR

If the ticket title is not already in context, call `notion-search` with query `JST-{ID}` to
retrieve it.

Then run:

```bash
gh pr create --draft \
  --title "JST-{ID}: {ticket title}" \
  --body "$(cat <<'EOF'
## JST-{ID}: {ticket title}

{1–3 sentence summary of what changed}

Notion ticket: https://app.notion.com/p/{notion-page-id}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If PR creation fails, stop and report the error. Do not update Notion.

---

## Step 4 — Update Notion ticket to In Review

Only run this step after the PR is successfully raised.

1. If not already known, call `notion-search` with query `JST-{ID}` to get the page ID.
2. Call `notion-update-page`:
   - `page_id`: the Notion page ID from the search result
   - `command`: `update_properties`
   - `properties`: `{"Status": "In Review"}`

Report the outcome:
- Success: "JST-{ID} marked as In Review on Notion."
- Failure: report the Notion error, but confirm the commit and PR succeeded.
