/**
 * Pure utility functions for filtering and sorting overlap clusters
 * on the overlaps page.
 *
 * All functions are side-effect free — they accept arrays and return new arrays
 * without mutating the inputs.
 */

import type { OverlapCluster } from './types';

/** Level filter mode for the overlaps page. */
export type LevelFilter = 'all' | 'no-plugins';

/**
 * Filter clusters by a search query matched against `skillIdentity`.
 *
 * The match is case-insensitive and trims leading/trailing whitespace.
 * An empty or whitespace-only query returns all clusters.
 *
 * @param clusters - Source cluster array.
 * @param query    - User-supplied search string.
 * @returns Filtered cluster array (new array, no mutation).
 */
export function filterClustersBySearch(
  clusters: OverlapCluster[],
  query: string
): OverlapCluster[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return clusters;
  return clusters.filter((c) =>
    c.skillIdentity.toLowerCase().includes(trimmed)
  );
}

/**
 * Filter clusters by level.
 *
 * - `'all'`        — return all clusters.
 * - `'no-plugins'` — exclude clusters where every file is plugin-level.
 *   Mixed clusters (e.g. one project file + one plugin file) are kept.
 *
 * @param clusters - Source cluster array.
 * @param level    - Which level filter to apply.
 * @returns Filtered cluster array (new array, no mutation).
 */
export function filterClustersByLevel(
  clusters: OverlapCluster[],
  level: LevelFilter
): OverlapCluster[] {
  if (level === 'all') return clusters;
  // 'no-plugins': exclude clusters where ALL files are plugin-level
  return clusters.filter((c) => c.files.some((f) => f.level !== 'plugin'));
}

/**
 * Sort clusters so that project-level and user-level clusters appear before
 * plugin-only clusters.
 *
 * Within each priority group the original order is preserved (stable sort).
 *
 * A cluster is considered "plugin-only" when every file in it has level === 'plugin'.
 *
 * @param clusters - Source cluster array.
 * @returns New sorted array (does not mutate input).
 */
export function sortClusters(clusters: OverlapCluster[]): OverlapCluster[] {
  return [...clusters].sort((a, b) => {
    const aIsPluginOnly = a.files.every((f) => f.level === 'plugin');
    const bIsPluginOnly = b.files.every((f) => f.level === 'plugin');
    if (aIsPluginOnly === bIsPluginOnly) return 0;
    return aIsPluginOnly ? 1 : -1;
  });
}

/**
 * Whether the "View diff" button should be shown for a cluster.
 *
 * The diff button is only meaningful when the cluster has drifted (i.e. at
 * least two files have different content). Identical clusters have no diff to
 * show, so the button is hidden.
 *
 * @param cluster - The overlap cluster to evaluate.
 * @returns `true` if the diff button should be shown.
 */
export function shouldShowDiff(cluster: OverlapCluster): boolean {
  return cluster.status === 'drifted';
}
