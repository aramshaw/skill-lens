/**
 * Contradiction analyzer — flags frontmatter field mismatches across copies of
 * the same skill file.
 *
 * This module is pure (no I/O). It accepts a flat array of SkillFile objects
 * and returns ContradictionFlag objects for every frontmatter field that has
 * at least two different values across files sharing the same filename.
 *
 * Rules:
 * - Files are grouped by filename (basename only, case-sensitive).
 * - Only the four specified fields are compared: model, effort, allowed-tools,
 *   user-invocable.
 * - A field is only flagged if it is explicitly present in ≥ 2 files AND those
 *   files carry at least 2 distinct values (missing-vs-present is NOT flagged).
 * - Severity: 'warning' for model/effort mismatches; 'info' for all others.
 */

import * as path from 'path';
import type { SkillFile, ContradictionFlag } from '@/lib/types';

/** Frontmatter fields to compare and their assigned severity. */
const FIELDS_TO_COMPARE: { field: string; severity: ContradictionFlag['severity'] }[] = [
  { field: 'model', severity: 'warning' },
  { field: 'effort', severity: 'warning' },
  { field: 'allowed-tools', severity: 'info' },
  { field: 'user-invocable', severity: 'info' },
];

/**
 * Analyze a flat list of SkillFiles and return contradiction flags for
 * frontmatter fields that differ across copies of the same filename.
 *
 * Algorithm:
 * 1. Group files by filename (basename only, case-sensitive).
 * 2. Discard singleton groups (no copies to compare).
 * 3. For each group and each watched field:
 *    a. Collect entries where the field is explicitly set (not undefined).
 *    b. Skip if fewer than 2 entries have the field (can't compare).
 *    c. Serialize each value for equality comparison.
 *    d. Skip if all entries share the same serialized value (no contradiction).
 *    e. Emit a ContradictionFlag with all entries and the assigned severity.
 *
 * @param files - Flat array of all SkillFile objects from a scan.
 * @returns An array of ContradictionFlag objects (may be empty).
 */
export function buildContradictionFlags(files: SkillFile[]): ContradictionFlag[] {
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

  const flags: ContradictionFlag[] = [];

  for (const [filename, group] of byFilename) {
    // Step 2 — skip singletons
    if (group.length < 2) {
      continue;
    }

    // Step 3 — check each watched field
    for (const { field, severity } of FIELDS_TO_COMPARE) {
      // Step 3a — collect entries where the field is explicitly present
      const entries: { projectName: string; level: string; value: unknown }[] = [];

      for (const file of group) {
        if (Object.prototype.hasOwnProperty.call(file.frontmatter, field)) {
          entries.push({
            projectName: file.projectName ?? '(user)',
            level: file.level,
            value: file.frontmatter[field],
          });
        }
      }

      // Step 3b — need at least 2 entries to detect a mismatch
      if (entries.length < 2) {
        continue;
      }

      // Step 3c + 3d — compare serialized values; skip if all identical
      const serialized = entries.map((e) => JSON.stringify(e.value));
      const distinct = new Set(serialized);
      if (distinct.size === 1) {
        continue;
      }

      // Step 3e — emit a flag
      flags.push({
        skillName: filename,
        field,
        values: entries,
        severity,
      });
    }
  }

  return flags;
}
