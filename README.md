# skill-lens

A local web app for visualizing, comparing, and understanding all your [Claude Code](https://code.claude.com) skills, agents, and rules across every project on your machine.

## The Problem

Claude Code skills live at multiple levels: user-level (`~/.claude/skills/`), project-level (`.claude/skills/`), and plugins. As your skill library grows across projects, it becomes impossible to keep track of:

- **Overlaps** — The same skill duplicated across multiple projects, slowly drifting apart
- **Gaps** — Projects missing skills that your other projects have
- **Contradictions** — Same-named skills with different `model:`, `effort:`, or `allowed-tools:` settings

`/context` tells you what Claude sees *right now*. Skill Lens tells you what's happening *across everything*.

## Features

### MVP

- **Unified inventory** — Every skill, agent, and rule across all projects in one searchable, sortable table
- **Overlap detection** — Clusters skills by filename and content hash to find duplicates and drift
- **Side-by-side diff** — Read-only comparison of overlapping skills
- **Gap flags** — "3 of 4 projects have this skill" indicators
- **Contradiction flags** — Frontmatter mismatches highlighted across copies
- **Open in editor** — One click to edit any skill file in your default `.md` editor

### Planned

- Frontmatter validation (missing descriptions, invalid model values)
- Copy/promote skills between levels (project <-> user)
- Dependency graph (which skills reference which tools/MCPs)

## How It Works

Skill Lens reads `~/.claude.json` to discover all known projects, then scans each for:

| File Type | Locations |
|---|---|
| Skills | `~/.claude/skills/`, `.claude/skills/` |
| Agents | `.claude/agents/` |
| Rules | `.claude/rules/` |
| CLAUDE.md | User + project level |
| Settings | `settings.json` (permissions subset) |

No data leaves your machine. No server. Just a local Next.js app reading your filesystem.

## Getting Started

```bash
git clone https://github.com/adamramshaw/skill-lens.git
cd skill-lens
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [React](https://react.dev)
- [shadcn/ui](https://ui.shadcn.com) components
- [Tailwind CSS](https://tailwindcss.com)
- TypeScript

## License

MIT
