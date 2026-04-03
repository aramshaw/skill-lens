/**
 * Shared display utilities for overlap cluster rendering.
 *
 * This module is pure — no server-only or browser-only dependencies,
 * so it can be imported from both server components and client components.
 */

import type { SkillFile } from './types';

/**
 * Returns a human-readable source label for a SkillFile copy in a cluster:
 * - user-level  → "User"
 * - plugin-level → plugin name (e.g. "my-plugin"), fallback to filePath
 * - project-level → project name (e.g. "my-app"), fallback to filePath
 */
export function locationLabel(skill: SkillFile): string {
  if (skill.level === 'user') return 'User';
  if (skill.level === 'plugin') return skill.pluginName ?? skill.filePath;
  return skill.projectName ?? skill.filePath;
}
