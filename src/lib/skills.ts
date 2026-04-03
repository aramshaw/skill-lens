/**
 * Pure utility functions for working with SkillFile collections.
 *
 * This module has no server-side dependencies — it can be safely imported from
 * both server components/routes and client components.
 */

import type { SkillFile } from '@/lib/types';

/** Priority ordering for levels — lower index = higher priority (wins dedup). */
const LEVEL_PRIORITY: SkillFile['level'][] = ['user', 'plugin', 'project'];

function levelPriority(level: SkillFile['level']): number {
  const idx = LEVEL_PRIORITY.indexOf(level);
  return idx === -1 ? LEVEL_PRIORITY.length : idx;
}

/**
 * Deduplicate a flat list of SkillFiles by `filePath`.
 *
 * When two entries share the same `filePath` (e.g. the home directory is both a
 * "project" and the user-level scan root, causing `~/.claude/skills/**` to be
 * scanned twice), the one with the higher-priority level is kept:
 * user > plugin > project.
 *
 * This is the canonical fix for the "duplicate rows in inventory" bug where
 * `~/.claude.json` lists `~/` as a project, causing the same physical files to
 * appear at both `project` level and `user` level.
 */
export function deduplicateSkills(skills: SkillFile[]): SkillFile[] {
  const best = new Map<string, SkillFile>();

  for (const skill of skills) {
    const existing = best.get(skill.filePath);
    if (!existing || levelPriority(skill.level) < levelPriority(existing.level)) {
      best.set(skill.filePath, skill);
    }
  }

  return Array.from(best.values());
}
