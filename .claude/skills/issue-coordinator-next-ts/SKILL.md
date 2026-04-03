---
name: issue-coordinator-next-ts
description: Issue-driven coordinator for Next.js/TypeScript projects. Accepts GitHub Issue numbers OR task IDs/phases. Spawns implement-issue-next-ts agents, verifies, marks complete. GitHub Issues are the source of truth for task state.
argument-hint: [#issue-numbers|phase-number|task-ids] [--dry-run] [--resume] [--no-merge]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git *), Bash(gh *), Bash(cat *), Bash(rm *batch-state.json), Task, Skill
model: opus
disable-model-invocation: true
---

# Issue Coordinator

Orchestrate implementation via GitHub Issues. Two modes:

1. **Issue-first (preferred):** User or planning agent creates GitHub Issues
   directly. Coordinator accepts issue numbers and spawns coding agents.
2. **YAML-first (legacy):** Reads task YAMLs from `docs/tasks/`, creates
   GitHub Issues just-in-time, then proceeds as above.

GitHub Issues are the **source of truth** for task state. Task YAMLs in
`docs/tasks/` are optional local documentation — they may or may not exist.

## Arguments

- `$ARGUMENTS` can be:
  - **Issue numbers:** `#42` or `#42,#43,#44` — work on existing GitHub Issues directly
  - A phase number (e.g., `2`) — work through all pending tasks in that phase (reads index.yaml)
  - Comma-separated task IDs (e.g., `T-0201,T-0202,T-0203`) — creates issues from YAMLs
  - `next` — pick the next eligible task across all phases
  - `--resume` — resume from `.claude/batch-state.json`
  - `--dry-run` — list tasks and dependency status without executing
  - `--no-merge` — passed through to implement-issue-next-ts

---

## Phase 0: Check for Resume

```bash
cat .claude/batch-state.json 2>/dev/null
```

If state exists with pending tasks, ask: Resume / Restart / Abort

---

## Phase 1: Gather Tasks

### Mode A: Issue numbers provided (`#42` or `#42,#43,#44`)

When the user provides GitHub Issue numbers directly:

```bash
# Read each issue to get its content
gh issue view 42 --json number,title,body,state
```

Build the work queue directly from issue data. **No YAML files needed.**
Skip dependency resolution (the planning agent already verified dependencies
when creating the issues). Skip Phase 2c (issue creation — already exists).

### Mode B: Task IDs or phase numbers (legacy YAML mode)

Read the task manifest and individual task files:

```bash
# Read the index to get the full task list
cat docs/tasks/index.yaml
```

**Build the work queue** based on arguments:

- **By phase:** Filter `index.yaml` for tasks in that phase with `status: pending`
- **By task IDs:** Select the specific tasks requested
- **`next`:** Find the first `pending` task whose `depends_on` are all `complete`

**Dependency resolution:** For each candidate task, read its YAML and verify
every task in `depends_on` has `status: complete` (or `status: pending` with an
existing closed issue). Skip tasks whose dependencies aren't satisfied.

**Display the plan:**
```
## Task Queue

Phase 2: Core Types & Scanner
  T-0201  SkillFile type + parser            (3 hrs)  READY
  T-0202  Scanner filesystem discovery        (3 hrs)  READY
  T-0203  Overlap + gap analyzer              (4 hrs)  READY
  T-0204  API routes + UI wiring              (3 hrs)  BLOCKED by T-0201, T-0202, T-0203

Dependency tree:
  T-0102 (complete) → T-0201 ─┐
  T-0102 (complete) → T-0202 ─┤→ T-0204
  T-0102 (complete) → T-0203 ─┘
```

**Save batch state:**
```json
{
  "batchId": "phase-2-20260315",
  "tasks": [
    {"taskId": "T-0201", "status": "pending", "issueNumber": null, "prNumber": null},
    {"taskId": "T-0202", "status": "pending", "issueNumber": null, "prNumber": null}
  ],
  "currentIndex": 0,
  "startedAt": "2026-03-15T10:00:00Z"
}
```

If `--dry-run`: Stop here.

---

## Coordinator Rules

- **NEVER edit application code directly** — always delegate to a spawned agent, even for small fixes
- **You MAY edit task YAMLs and batch-state.json** — that's your job (tracking progress)
- **NEVER skip CI/test verification** — a merged PR with failing tests blocks the entire batch
- **Update batch-state.json after each task** — so `--resume` works if context runs out
- **Check context usage after every task** — stop and report if getting full
- **Re-check dependencies after each completion** — a finished task may unblock others in the queue

---

## Execution Model: Serial on Branches

Agents run **on feature branches in the main repo** — no worktrees. Each agent
creates a branch from main, implements, pushes, creates a PR, and merges.

**Run one agent at a time.** PRs must merge sequentially to avoid conflicts.

1. Ensure main is clean and up to date
2. Create GitHub Issue from task YAML
3. Spawn coding agent to implement the issue
4. Verify PR/CI
5. Spawn verification agent to independently confirm ACs
6. Mark task complete, pull latest main, then start next task

**IMPORTANT: Do NOT use `isolation: "worktree"` when spawning agents.** Worktrees cause Windows MAX_PATH failures due to nested `.claude/worktrees/` paths.

**Monitor for stuck agents:** If an agent uses 50+ tools without making any commits, it's likely stuck in an analysis loop. Stop it and restart with a more direct prompt emphasizing "be efficient, read the relevant files, make changes, commit."

---

## Phase 2: Execute Tasks

For each task in the queue:

### 2a. Pre-flight
```bash
git status --porcelain
git branch --show-current
```
Ensure on `main` with clean state. If on a leftover branch from a failed agent:
```bash
git checkout main
git pull origin main
```

### 2b. Re-check dependencies

Read the task YAML and verify all `depends_on` tasks have `status: complete`:
```bash
cat docs/tasks/T-XXXX.yaml
```
For each dependency, check its status:
```bash
grep "^status:" docs/tasks/T-YYYY.yaml
```

If any dependency is not complete: skip this task, log as `"blocked"`, continue to next.

### 2c. Create GitHub Issue (skip if issue already exists)

**If working from an issue number (Mode A):** Skip this step entirely — the
issue already exists. Proceed to 2d.

**If working from a task YAML (Mode B):** Read the task YAML and create a
GitHub Issue:

```bash
# Read the task file
cat docs/tasks/T-XXXX.yaml
```

**Create the issue using --body-file (NEVER use inline --body with markdown headers — it triggers a security prompt):**

1. Use the Write tool to create `.claude/tmp-body.md` with the issue body:
```markdown
## Task Reference
**Task ID:** T-XXXX
**Phase:** N — Phase Name
**Estimated:** X hours
**Depends on:** T-YYYY, T-ZZZZ

## Description
[description field from task YAML]

## Context Files
[list from context_files]

## Reference Files
[list from reference_files]

## Output Files
[list from output_files]

## Acceptance Criteria
- [ ] [AC 1 from task YAML]
- [ ] [AC 2 from task YAML]
- [ ] [AC N from task YAML]
```

2. Then create the issue:
```bash
gh issue create --title "[T-XXXX] Task title from YAML" --label "phase-N" --body-file .claude/tmp-body.md
```

**Why --body-file?** Inline `--body` with `#`-prefixed lines after newlines triggers
Claude Code's "quoted newline + # line" security check, which cannot be pre-approved
and causes a manual approval prompt every time. Using `--body-file` avoids this entirely.

Update batch state with the issue number.

### 2d. Spawn agent

Use Task tool with `subagent_type: "general-purpose"`:
```
Implement issue #[ISSUE_NUM] following the implement-issue-next-ts agent workflow in .claude/agents/implement-issue-next-ts/SKILL.md. [FLAGS]

RULE ZERO (non-negotiable): All `gh pr create` and `gh issue create` commands MUST include `--body "..."` — without it the command hangs forever and kills the agent. Example: `gh pr create --title "fix: thing" --body "Description"`. After creating a PR, ALWAYS verify with: `gh pr view --json number,url`.

Task context:
- Task ID: T-XXXX
- Read the task YAML at docs/tasks/T-XXXX.yaml for context_files, output_files, and acceptance_criteria
- Read each file listed in context_files before starting implementation
- Output files MUST match those listed in the task YAML

Additional rules:
- Implementation must be END-TO-END — don't just create helpers, wire them into calling code.
- Do NOT use worktrees. Work on a feature branch in the main repo.
- Run `npm run lint` and `npm test` before creating the PR.
- In your report, include summary of changes, task ID T-XXXX, and any skipped phases.

Report: status (success/failed/blocked), PR URL, summary, task ID T-XXXX, and any skipped phases.
```

**Do NOT use `subagent_type: "action-issue"`** — that built-in agent type creates worktrees which cause Windows MAX_PATH failures.

**Wait for the agent to complete before continuing.**

### 2e. Wait and capture result

### 2f. VERIFY via GitHub CLI (mandatory)

**Always verify — don't trust agent responses alone.**

**First, verify a PR actually exists (catches agents that hung on `gh pr create`):**
```bash
gh pr list --state all --head "fix/issue-[NUMBER]*" --json number,url,state --limit 1
gh pr list --state all --head "feature/issue-[NUMBER]*" --json number,url,state --limit 1
```
If no PR exists and the agent reported success, the agent hung on `gh pr create` (missing `--body`). Re-spawn with: "Create a PR for branch [BRANCH] with `--body` flag. The previous agent hung because it omitted `--body`."

**Then check PR and issue state:**
```bash
gh pr list --state all --limit 5 --json number,title,state,url,headRefName
gh pr view [PR_NUM] --json state,merged,mergeable
gh issue view [ISSUE_NUM] --json state
```

| PR State | Issue State | Action |
|----------|-------------|--------|
| Merged | Closed | Verify tests (below) |
| Merged | Open | Close issue, verify tests |
| Open + mergeable | Any | Merge PR, close issue, verify tests |
| Open + conflicts/failing | Any | Log as failed |
| No PR | Open | Agent didn't complete — failed |

**After any successful merge, verify tests pass on main** (if CI is configured):
```bash
gh run list --branch main --limit 1 --json databaseId,status,conclusion
# If status is "in_progress", wait:
gh run watch <ID> --exit-status
```

If no CI is configured yet (early phases), verify locally:
```bash
npm run lint
npm test
```

If tests are green: continue. If red: see 2f-alt.

### 2f-alt. Test Failure Recovery

If tests fail after merge:
1. Spawn a dedicated fix agent with the error details
2. Agent fixes on main, commits, pushes directly
3. Wait for tests to pass
4. Then continue to next task

### 2g-verify. Spawn Verification Agent (mandatory)

After the PR is merged and tests pass, spawn the devil's advocate agent to
independently verify acceptance criteria. **Do not skip this step.**

Spawn an Agent (general-purpose, NOT in background — wait for the result):

```
Verify the implementation for issue #[ISSUE_NUM] following the verify-issue-next-ts agent
workflow in .claude/agents/verify-issue-next-ts/SKILL.md.

Context:
- Issue number: [ISSUE_NUM]
- Task ID: T-XXXX
- PR number: [PR_NUM]
- The PR is already merged to main. You are verifying the work, not implementing.

Your job: independently verify every acceptance criterion has real test coverage,
run the tests yourself, inspect the implementation for gaps, then update the
issue checkboxes to reflect reality. Be skeptical.

IMPORTANT: Do NOT prefix commands with `cd "..." &&`. The working directory is
already the project root. Run all commands directly.
```

**Evaluate the verification report:**

| Verdict | Action |
|---------|--------|
| PASS | Continue to 2h |
| FAIL (shallow tests) | Log as warning, continue — note in batch state |
| FAIL (missing AC coverage) | Spawn fix agent to add missing tests, then re-verify |
| FAIL (broken implementation) | Spawn fix agent, then re-verify (max 1 retry) |

### 2h. Sync main
```bash
git checkout main
git pull origin main
```

### 2i. Verify issue closed
```bash
gh issue view [ISSUE_NUM] --json state
# If still open after merged PR:
gh issue close [ISSUE_NUM] --reason completed
```

### 2j. Mark task complete

**Close the GitHub Issue** (if not already closed by the PR):
```bash
gh issue close [ISSUE_NUM] --reason completed
```

**If a task YAML exists**, update it to record completion:

```bash
# Check if YAML exists
cat docs/tasks/T-XXXX.yaml 2>/dev/null
```

If it exists, use the Edit tool to update:
```yaml
status: complete
issue_number: [ISSUE_NUM]
pr_number: [PR_NUM]
completed_at: "2026-03-15T14:30:00Z"
```

**If `docs/tasks/index.yaml` references this task**, update its status there too.

**If no YAML exists (issue-first mode):** The GitHub Issue closure IS the
completion record. No YAML update needed.

### 2k. Re-evaluate queue

After completing a task, check if any previously blocked tasks are now unblocked:
- For each remaining task in the queue with status `blocked`, re-check its `depends_on`
- If all dependencies are now `complete`, change its queue status to `pending`

### 2l. Update batch state

Update `.claude/batch-state.json`:
- Set current task status to `"success"` / `"failed"` / `"skipped"`
- Record issue number, PR number, and duration
- Increment `currentIndex`
- Write the file so `--resume` works

---

## Phase 3: Adaptation

After each agent:
- If success: Note patterns, continue
- If failed: Analyze, decide retry/skip/stop
- If 3+ consecutive failures: Ask user for direction

---

## Phase 4: Final Report

```
## Batch Complete

**Processed:** N tasks
**Succeeded:** X | **Failed:** Y | **Skipped:** Z | **Blocked:** W
**Duration:** HH:MM:SS

| Task | Title | Status | Issue | PR | Duration |
|------|-------|--------|-------|-----|----------|
| T-0201 | SkillFile type + parser | complete | #12 | #13 | 3:45 |
| T-0202 | Scanner discovery | complete | #14 | #15 | 2:30 |
| T-0204 | API routes + UI | failed | #16 | - | 5:12 |

### Failures
[Details for each failure]

### Newly Unblocked
[Tasks that became eligible after this batch]

### Next Steps
- Review failed tasks manually
- Run `/issue-coordinator-next-ts [next-phase]` for next batch
```

---

## Phase 5: Cleanup

Use the Write tool to clear batch state (do NOT use `rm` on `.claude/` files —
it triggers a sensitive-file security prompt):

```json
// Write to .claude/batch-state.json:
{"batchId": "...", "status": "complete"}
```

Or simply leave it — it's gitignored and gets overwritten at the start of each batch.

---

## Error Handling

- **Agent timeout:** Log, switch back to main, mark task as `failed`, continue
- **Agent fails mid-task:** Check what the agent left behind:
  ```bash
  # Did it push a branch?
  git branch -r | grep "issue-[NUMBER]"
  # Did it create a PR?
  gh pr list --state all --head "fix/issue-[NUMBER]*" --json number,state,url
  ```
  - If PR exists and is mergeable: merge it (the work is done)
  - If branch exists but no PR: inspect the branch, decide retry/skip
  - If nothing pushed: switch to main, retry from scratch
- **Dirty working directory after failure:**
  ```bash
  git checkout main
  git pull origin main
  ```
- **Merge conflicts:** Log and continue (needs manual fix)
- **3+ consecutive failures:** Ask user for direction
- **Bad repo state:** Run `git checkout main && git pull origin main`, then reassess
- **Task YAML update fails:** Log warning but don't block — the issue/PR are the durable record
