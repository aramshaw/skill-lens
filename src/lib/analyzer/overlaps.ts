/**
 * Overlap analyzer — clusters SkillFiles by filename and content hash.
 *
 * This module is pure (no I/O). It accepts a flat array of SkillFile objects
 * and returns an OverlapCluster array that groups files sharing the same
 * filename. Singletons (files whose filename appears only once across all
 * input) are excluded from the result.
 */

import * as path from 'path';
import type { SkillFile, OverlapCluster } from '@/lib/types';

/**
 * Analyze a flat list of SkillFiles and return clusters of overlapping files.
 *
 * Algorithm:
 * 1. Group files by filename (basename only, case-sensitive).
 * 2. Discard groups with fewer than 2 files (singletons).
 * 3. For each remaining group, group files again by content hash.
 * 4. If all files share the same hash → status = 'identical'.
 *    If there are 2+ distinct hashes  → status = 'drifted'.
 *
 * @param files - Flat array of all SkillFile objects from a scan.
 * @returns An array of OverlapCluster objects, one per overlapping filename.
 */
export function buildOverlapClusters(files: SkillFile[]): OverlapCluster[] {
  // Step 1 — group by filename
  const byFilename = new Map<string, SkillFile[]>();

  for (const file of files) {
    const filename = path.basename(file.filePath);
    const group = byFilename.get(filename);
    if (group) {
      group.push(file);
    } else {
      byFilename.set(filename, [file]);
    }
  }

  // Step 2 + 3 + 4 — build clusters, skipping singletons
  const clusters: OverlapCluster[] = [];

  for (const [filename, group] of byFilename) {
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

    clusters.push({
      filename,
      files: group,
      status,
      hashGroups,
    });
  }

  return clusters;
}
