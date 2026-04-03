/**
 * Gap analyzer — flags skills that are present in some projects but missing from others.
 *
 * This module is pure (no I/O). It accepts a flat array of SkillFile objects and
 * a list of all known Projects, then returns GapFlag objects for skills that are
 * "common enough" but not universally deployed.
 *
 * Rules:
 * - User-level skills (level === 'user') are excluded — they're available everywhere.
 * - The coverage threshold is adaptive:
 *   - For small project counts (< 4 projects): a skill must appear in at least 2 projects.
 *   - For larger counts: a skill must appear in >= 50% of projects.
 *   This prevents the threshold from blocking all results with small project sets.
 * - A gap is only reported when at least one project is missing the skill.
 */

import * as path from 'path';
import type { SkillFile, Project, GapFlag } from '@/lib/types';

/**
 * Compute the minimum number of projects a skill must appear in to be flagged as a gap.
 *
 * The threshold is adaptive:
 * - For small project counts (< 4): require at least 2 projects (absolute minimum).
 * - For larger counts: require >= 50% coverage (relative threshold).
 *
 * Examples:
 *   2 projects → min 2 (100% — only flags if present in all but 1 is impossible since 2/2=100%, so
 *                       the 50% threshold = 1, but we clamp to 2 so we never flag with 1 copy)
 *   3 projects → min 2 (67% → 2 of 3)
 *   4 projects → min 2 (50% = 2 of 4)
 *   6 projects → min 3 (50% = 3 of 6)
 *
 * @internal Exported for testing.
 */
export function computeGapThreshold(totalProjects: number): number {
  const halfFloor = Math.ceil(totalProjects * 0.5);
  return Math.max(2, halfFloor);
}

/**
 * Analyze a flat list of SkillFiles and a list of all known Projects, returning
 * GapFlag objects for skills that are missing from some (but not all) projects.
 *
 * Algorithm:
 * 1. Filter out user-level skills entirely.
 * 2. Group remaining files by filename (basename).
 * 3. For each filename group, collect the set of project names that HAVE it
 *    (only from files with a non-null projectName).
 * 4. Compute coverage = projectsWithSkill.size.
 * 5. Skip if coverage < computeGapThreshold(totalProjects), or if no project is missing the skill.
 * 6. Build and return a GapFlag for each qualifying filename.
 *
 * @param files    - Flat array of all SkillFile objects from a scan.
 * @param projects - All known projects (used to determine total count and missing projects).
 * @returns An array of GapFlag objects, one per qualifying filename.
 */
export function buildGapFlags(files: SkillFile[], projects: Project[]): GapFlag[] {
  const totalProjects = projects.length;

  // Degenerate case — can't compute gaps with fewer than 2 projects
  if (totalProjects < 2) {
    return [];
  }

  // Adaptive threshold: minimum number of projects a skill must appear in
  const minProjectCount = computeGapThreshold(totalProjects);

  // Step 1: Exclude user-level files
  const projectLevelFiles = files.filter((f) => f.level !== 'user');

  // Step 2: Group by filename (basename)
  const byFilename = new Map<string, SkillFile[]>();
  for (const file of projectLevelFiles) {
    const filename = path.basename(file.filePath);
    const group = byFilename.get(filename);
    if (group) {
      group.push(file);
    } else {
      byFilename.set(filename, [file]);
    }
  }

  // Build a set of all known project names for quick lookup
  const allProjectNames = new Set(projects.map((p) => p.name));

  const flags: GapFlag[] = [];

  for (const [filename, group] of byFilename) {
    // Step 3: Collect projects that HAVE this skill (only those with a projectName)
    const presentProjectNames = new Set<string>();
    const presentInEntries: { projectName: string; level: string }[] = [];

    for (const file of group) {
      if (file.projectName !== null && allProjectNames.has(file.projectName)) {
        if (!presentProjectNames.has(file.projectName)) {
          presentProjectNames.add(file.projectName);
          presentInEntries.push({
            projectName: file.projectName,
            level: file.level,
          });
        }
      }
    }

    // If no project-level entries with known project names, skip
    if (presentProjectNames.size === 0) {
      continue;
    }

    // Step 4 + 5: Skip if below adaptive threshold
    if (presentProjectNames.size < minProjectCount) {
      continue;
    }

    // Determine which projects are missing this skill
    const missingFrom = projects
      .filter((p) => !presentProjectNames.has(p.name))
      .map((p) => ({ projectName: p.name }));

    // If no projects are missing it, there's no gap to flag
    if (missingFrom.length === 0) {
      continue;
    }

    // Step 6: Build the GapFlag
    flags.push({
      skillName: filename,
      presentIn: presentInEntries,
      missingFrom,
      coverage: `${presentProjectNames.size} of ${totalProjects} projects`,
    });
  }

  return flags;
}
