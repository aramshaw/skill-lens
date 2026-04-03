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
