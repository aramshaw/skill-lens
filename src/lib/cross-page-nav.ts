/**
 * Cross-page navigation URL builders.
 *
 * Pure functions — no side effects, no DOM/router imports — so they can be
 * imported in both client components and unit tests without special mocking.
 */

/**
 * Builds a URL to the Overlaps page pre-filtered to the given skill identity.
 *
 * @param skillIdentity - The cluster's `skillIdentity` value, e.g. "code-review/SKILL.md"
 * @returns A URL string like `/overlaps?search=code-review%2FSKILL.md`
 */
export function buildOverlapsUrl(skillIdentity: string): string {
  if (!skillIdentity) return '/overlaps';
  const params = new URLSearchParams({ search: skillIdentity });
  return `/overlaps?${params.toString()}`;
}

/**
 * Builds a URL to the Inventory page pre-filtered to the given skill name.
 *
 * @param skillName - The skill name or filename to search for, e.g. "code-review"
 * @returns A URL string like `/?search=code-review`
 */
export function buildInventorySearchUrl(skillName: string): string {
  if (!skillName) return '/';
  const params = new URLSearchParams({ search: skillName });
  return `/?${params.toString()}`;
}

/**
 * Safely parses a search query parameter value.
 *
 * Normalises `null` / `undefined` to an empty string and trims whitespace.
 *
 * @param param - The raw query param value (from `useSearchParams` or similar)
 * @returns Trimmed string, or `""` if absent/empty.
 */
export function parseSearchParam(param: string | null | undefined): string {
  if (param == null) return '';
  return param.trim();
}
