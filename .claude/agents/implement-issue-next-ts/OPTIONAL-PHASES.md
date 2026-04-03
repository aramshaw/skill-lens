# Optional Phases for implement-issue-next-ts

These phases are optional and often skipped in spawned agents (Skill tool may not be available).

## Phase 5: Coverage Verification

Run coverage analysis to check for untested code paths:

```bash
npm test -- --coverage
```

**If significant gaps are found:** Write the missing tests before proceeding.

**Note:** If running inside a spawned agent where coverage tools aren't configured, **skip and report that coverage check was skipped** in your final report.

---

## Phase 6: Visual Testing (UI/template changes only)

Skip if: backend-only, config/docs only

Use Playwright for visual regression testing if configured:

```bash
npx playwright test --grep "visual"
```

If no visual tests exist, use Playwright screenshots for manual inspection.

---

## Phase 8b: Code Review

```
/code-review:code-review
```

Fix critical/high findings, re-run tests, amend commit if needed.

**Note:** `/code-review` requires the Skill tool, which may not be available inside spawned agents. If unavailable, **skip and report that code review was skipped** in your final report.
