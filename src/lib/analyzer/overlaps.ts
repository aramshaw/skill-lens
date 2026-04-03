/**
 * Overlap analyzer — clusters SkillFiles by skill identity and content hash.
 *
 * This module is pure (no I/O). It accepts a flat array of SkillFile objects
 * and returns an OverlapCluster array that groups files sharing the same
 * skill identity. Singletons (files whose identity appears only once across
 * all input) are excluded from the result.
 *
 * ## What is "skill identity"?
 *
 * Identity is defined as `parentDirName/filename` — the last two path segments.
 * For example:
 *   - `.claude/skills/code-review/SKILL.md`  → identity = `code-review/SKILL.md`
 *   - `.claude/skills/deploy/SKILL.md`        → identity = `deploy/SKILL.md`
 *   - `.claude/rules/style/RULE.md`           → identity = `style/RULE.md`
 *
 * This prevents common filenames like `SKILL.md`, `RULE.md`, and `README.md`
 * from creating massive false clusters that group hundreds of completely unrelated
 * skills just because they share a filename convention.
 *
 * Files with no parent directory fall back to using just the filename as their
 * identity key.
 */

import * as path from 'path';
import type { SkillFile, OverlapCluster } from '@/lib/types';

/**
 * Derive the skill identity key for a given file path.
 *
 * Identity = `parentDirName/filename`. Falls back to just `filename` when
 * the file sits at the root (no parent directory segment).
 *
 * Examples:
 *   `/repos/proj/.claude/skills/code-review/SKILL.md` → `code-review/SKILL.md`
 *   `/repos/proj/.claude/rules/style/RULE.md`         → `style/RULE.md`
 *   `SKILL.md`                                         → `SKILL.md`
 *
 * @internal Exported for unit testing only.
 */
export function skillIdentityKey(filePath: string): string {
  const filename = path.basename(filePath);
  const parentDir = path.basename(path.dirname(filePath));

  // path.basename('.') or path.basename('') returns '.' or '' — treat these
  // as "no parent directory" and fall back to filename-only identity.
  if (!parentDir || parentDir === '.') {
    return filename;
  }

  return `${parentDir}/${filename}`;
}

/**
 * Analyze a flat list of SkillFiles and return clusters of overlapping files.
 *
 * Algorithm:
 * 1. Group files by skill identity (parentDirName/filename).
 * 2. Discard groups with fewer than 2 files (singletons).
 * 3. For each remaining group, group files again by content hash.
 * 4. If all files share the same hash → status = 'identical'.
 *    If there are 2+ distinct hashes  → status = 'drifted'.
 *
 * @param files - Flat array of all SkillFile objects from a scan.
 * @returns An array of OverlapCluster objects, one per overlapping skill identity.
 */
export function buildOverlapClusters(files: SkillFile[]): OverlapCluster[] {
  // Step 1 — group by skill identity
  const byIdentity = new Map<string, SkillFile[]>();

  for (const file of files) {
    const identity = skillIdentityKey(file.filePath);
    const group = byIdentity.get(identity);
    if (group) {
      group.push(file);
    } else {
      byIdentity.set(identity, [file]);
    }
  }

  // Step 2 + 3 + 4 — build clusters, skipping singletons
  const clusters: OverlapCluster[] = [];

  for (const [identity, group] of byIdentity) {
    // Ignore singletons
    if (group.length < 2) {
      continue;
    }

    // Group files by content hash
    const hashGroups: Record<string, SkillFile[]> = {};
    for (const file of group) {
      const existing = hashGroups[file.contentHash];
      if (existing) {
        existing.push(file);
      } else {
        hashGroups[file.contentHash] = [file];
      }
    }

    // Determine status
    const distinctHashes = Object.keys(hashGroups).length;
    const status: OverlapCluster['status'] = distinctHashes === 1 ? 'identical' : 'drifted';

    // Derive the display filename from the first file in the group
    const filename = path.basename(group[0].filePath);

    clusters.push({
      skillIdentity: identity,
      filename,
      files: group,
      status,
      hashGroups,
    });
  }

  return clusters;
}
