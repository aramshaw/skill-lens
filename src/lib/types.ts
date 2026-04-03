/**
 * Core TypeScript types for the skill-lens scanner output.
 * This file is types-only — no runtime code.
 */

/**
 * A parsed skill, agent, or rule file discovered during scanning.
 */
export interface SkillFile {
  /** Absolute path to the file on disk. */
  filePath: string;

  /** Display name — from frontmatter `name` field or derived from filename. */
  name: string;

  /** Short description from frontmatter, or empty string. */
  description: string;

  /** File category: skill definition, agent definition, or rule. */
  type: 'skill' | 'agent' | 'rule';

  /**
   * Scope level where this file lives:
   * - `user`    — ~/.claude/skills/ or ~/.claude/agents/
   * - `project` — <project>/.claude/skills/ or <project>/.claude/agents/
   * - `plugin`  — ~/.claude/plugins/<plugin>/
   */
  level: 'user' | 'project' | 'plugin';

  /** Name of the owning project, or null for user-level / plugin files. */
  projectName: string | null;

  /** Absolute path to the owning project root, or null for user-level / plugin files. */
  projectPath: string | null;

  /** Raw YAML frontmatter parsed from the file (all fields). */
  frontmatter: Record<string, unknown>;

  /** Markdown content that follows the frontmatter block. */
  body: string;

  /** SHA-256 (or similar) hash of the file content — used for duplicate detection. */
  contentHash: string;
}

/**
 * A project discovered via ~/.claude.json or manually added paths.
 */
export interface Project {
  /** Human-readable project name (typically the directory basename). */
  name: string;

  /** Absolute path to the project root directory. */
  path: string;

  /** All skill/agent/rule files found inside this project. */
  skills: SkillFile[];
}

/**
 * A cluster of SkillFiles that share the same filename across different locations.
 *
 * Singletons (skills that exist in only one location) are excluded — a cluster
 * must contain at least two files.
 */
export interface OverlapCluster {
  /** The shared filename (e.g. "save.md" or "SKILL.md"). */
  filename: string;

  /** All files in this cluster. At least two entries. */
  files: SkillFile[];

  /**
   * Whether every file in the cluster has the same content:
   * - `identical` — all files share the same content hash (exact duplicates)
   * - `drifted`   — at least two files have different content hashes (diverged copies)
   */
  status: 'identical' | 'drifted';

  /**
   * Files grouped by content hash.
   * Using Record instead of Map so the value is directly JSON-serializable.
   * Each key is a content hash; each value is the list of files sharing that hash.
   */
  hashGroups: Record<string, SkillFile[]>;
}

/**
 * A gap flag — a skill that exists in some projects but is missing from others.
 *
 * Only generated for skills whose filename appears in at least 50% of the known
 * projects (the "common enough to matter" threshold). User-level skills are
 * excluded because they are available everywhere.
 */
export interface GapFlag {
  /** The shared filename (e.g. "lint.md" or "SKILL.md"). */
  skillName: string;

  /**
   * Projects that DO have this skill, with their level.
   * Only project-level and plugin-level files are included here
   * (user-level files are excluded from gap analysis).
   */
  presentIn: { projectName: string; level: string }[];

  /** Projects that do NOT have a file with this filename. */
  missingFrom: { projectName: string }[];

  /**
   * Human-readable coverage summary, e.g. "3 of 5 projects".
   * Numerator = number of projects with the skill.
   * Denominator = total number of known projects.
   */
  coverage: string;
}

/**
 * A contradiction flag — a frontmatter field that has different values across
 * copies of the same skill file in different projects/levels.
 *
 * Only generated when the field is present in at least two copies AND the
 * values actually differ (missing-vs-present is not flagged).
 */
export interface ContradictionFlag {
  /** The shared filename (e.g. "save.md" or "SKILL.md"). */
  skillName: string;

  /** Which frontmatter field differs (e.g. "model", "effort"). */
  field: string;

  /**
   * One entry per SkillFile that has this field, with the value it carries.
   * Files without the field are omitted.
   */
  values: { projectName: string; level: string; value: unknown }[];

  /**
   * Severity of the contradiction:
   * - `warning` — model or effort mismatches (affect behaviour significantly)
   * - `info`    — allowed-tools or user-invocable mismatches (lower impact)
   */
  severity: 'warning' | 'info';
}

/**
 * The complete output of a single scan run.
 */
export interface ScanResult {
  /** All discovered projects, each with their associated skill files. */
  projects: Project[];

  /** User-level skill/agent files from ~/.claude/skills/ and ~/.claude/agents/. */
  userSkills: SkillFile[];

  /** Plugin-provided skill files from ~/.claude/plugins/. */
  pluginSkills: SkillFile[];

  /** ISO 8601 timestamp of when the scan was performed. */
  scannedAt: string;
}
