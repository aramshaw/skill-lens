/**
 * Skill/agent/rule file parser.
 *
 * Reads a markdown file with optional YAML frontmatter and returns a
 * fully-populated SkillFile object.
 *
 * This module is server-side only (Node.js). It is intentionally read-only.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import matter from 'gray-matter';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Determine skill file type from the file path. */
function detectType(filePath: string): SkillFile['type'] {
  // Normalize to forward slashes for consistent matching
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/agents/')) return 'agent';
  if (normalized.includes('/rules/')) return 'rule';
  return 'skill';
}

/**
 * Derive a display name from the file path when frontmatter has no `name`.
 *
 * Convention used by Claude Code:
 *   ~/.claude/skills/<name>/SKILL.md   → uses the directory name
 *   ~/.claude/rules/<name>.md          → uses the file basename without extension
 */
function deriveName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);
  const noExt = basename.replace(/\.[^.]+$/, '');

  // If the file is named SKILL.md (or similar convention), use parent dir name
  if (noExt.toUpperCase() === 'SKILL' || noExt.toUpperCase() === 'AGENT') {
    const dir = path.dirname(normalized);
    return path.basename(dir);
  }

  return noExt;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse a skill/agent/rule markdown file into a SkillFile object.
 *
 * @param filePath    Absolute path to the file on disk.
 * @param level       Scope level: 'user' | 'project' | 'plugin'.
 * @param projectName Optional name of the owning project.
 * @param projectPath Optional absolute path to the owning project root.
 */
export function parseSkillFile(
  filePath: string,
  level: SkillFile['level'],
  projectName: string | null = null,
  projectPath: string | null = null
): SkillFile {
  // 1. Read file content
  const raw = fs.readFileSync(filePath, 'utf-8');

  // 2. Generate SHA-256 hash of full raw content
  const contentHash = crypto.createHash('sha256').update(raw).digest('hex');

  // 3. Parse frontmatter + body (gray-matter handles missing / malformed gracefully)
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    // Malformed YAML — treat as no frontmatter
    parsed = { data: {}, content: raw, orig: raw } as matter.GrayMatterFile<string>;
  }

  const frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
  const body = parsed.content ?? '';

  // 4. Determine type from path
  const type = detectType(filePath);

  // 5. Resolve display name
  const name =
    typeof frontmatter['name'] === 'string' && frontmatter['name'].trim()
      ? (frontmatter['name'] as string).trim()
      : deriveName(filePath);

  // 6. Resolve description
  const description =
    typeof frontmatter['description'] === 'string'
      ? (frontmatter['description'] as string)
      : '';

  return {
    filePath,
    name,
    description,
    type,
    level,
    projectName,
    projectPath,
    frontmatter,
    body,
    contentHash,
  };
}
