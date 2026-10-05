# Skill Lens

Local web app for visualizing and analyzing Claude Code skills across all projects.

## Tech Stack
- Next.js (App Router) + React + TypeScript
- shadcn/ui components + Tailwind CSS
- No database — filesystem scan on page load via API routes

## Architecture

### Data Flow
1. **Scanner** (`lib/scanner/`) reads `~/.claude.json` to discover projects
2. Scanner walks each project for skills (`.claude/skills/`), agents (`.claude/agents/`), rules (`.claude/rules/`), CLAUDE.md files
3. **Parser** (`lib/parser/`) extracts YAML frontmatter + markdown body from each file
4. **Analyzer** (`lib/analyzer/`) computes overlaps (filename + content hash), gaps, and contradictions
5. **API routes** (`app/api/`) serve scan results as JSON
6. **UI** (`app/`) renders inventory table, overlap clusters, diff views

### Key Types (defined in `lib/types.ts`)
- `SkillFile` — parsed skill/agent/rule with frontmatter, body, file path, level (user/project/plugin), project name
- `OverlapCluster` — group of SkillFiles sharing a filename, with content hashes and diff status
- `GapFlag` — skill present in N of M projects
- `ContradictionFlag` — frontmatter field mismatch across copies

### Scanner Config
- Primary discovery: `~/.claude.json` → `projects` keys for project paths
- Additional paths can be added via the UI (stored in localStorage)
- User-level skills: `~/.claude/skills/`, `~/.claude/agents/`
- Plugin skills: `~/.claude/plugins/`

## Conventions
- API routes return typed JSON, no ORM or database
- Components in `components/` use shadcn/ui primitives
- Keep the scanner read-only — never write to skill files from the app
- "Open in editor" uses OS default handler (`start "" "path"` on Windows)
- All paths handled as POSIX internally, converted at OS boundary

## Running
```bash
npm run dev    # development server on :3000
npm run build  # production build
```

## Fleet upgrade pending (added 2026-10-05)

Adam's coordinator, PM and agent skills were consolidated into one personal-level master
(`~/.claude/skills/issue-coordinator/`; called `issue-coordinator-next` before go-live). This project is
on hold, so it was deliberately left on its old local copies: `.claude/skills/issue-coordinator-next-ts`,
`.claude/agents/implement-issue-next-ts` and `verify-issue-next-ts` (local only, not committed).

**Their names differ from the master's, so the master does not replace them: `/issue-coordinator-next-ts`
would still run the old copy.** Don't use them. Before any coordinator, PM or agent work here, stop and
tell Adam the upgrade is due, then do it with him:

1. Add a `## Coordinator config` section to this file. Template: `reference/config-template.md` in the
   master skill. Expect `trunk: main`; for `stack`, use `nextjs-supabase` (ignore its Supabase parts)
   or add a plain `nextjs` stack file to the master first.
2. Fix the preconditions the master checks: there is no CI and no gate command yet. Add a `check`
   script (tsc, lint, tests) and a CI workflow that runs it.
3. Validate with `python ~/.claude/skills/issue-coordinator/scripts/read_config.py`, then run
   `/issue-coordinator --dry-run`.
4. Delete the three local `-next-ts` folders, then this section.
