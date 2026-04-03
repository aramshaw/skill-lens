/**
 * Unit tests for cross-page navigation URL builders.
 *
 * AC1: "Skill detail panel includes a link to view that skill's overlaps (if any exist)"
 *   → unit (pure URL generation logic)
 * AC2: "Contradiction/gap cards link back to the relevant skills in the inventory"
 *   → unit (pure URL generation logic)
 * AC3: "Cross-page navigation preserves context (filters, selected items)"
 *   → unit (URL param encoding round-trip)
 */

import { describe, it, expect } from 'vitest';
import {
  buildOverlapsUrl,
  buildInventorySearchUrl,
  parseSearchParam,
} from './cross-page-nav';

// ---------------------------------------------------------------------------
// buildOverlapsUrl
// ---------------------------------------------------------------------------

describe('buildOverlapsUrl', () => {
  it('returns /overlaps with a search param for a given skill identity', () => {
    const url = buildOverlapsUrl('code-review/SKILL.md');
    expect(url).toBe('/overlaps?search=code-review%2FSKILL.md');
  });

  it('handles simple filenames without parent directory', () => {
    const url = buildOverlapsUrl('lint.md');
    expect(url).toBe('/overlaps?search=lint.md');
  });

  it('encodes special characters in skill identity', () => {
    const url = buildOverlapsUrl('my skill/SKILL.md');
    // URLSearchParams encodes space as + and / as %2F
    expect(url.startsWith('/overlaps?search=')).toBe(true);
    expect(url).toContain('SKILL.md');
    // Slash is encoded
    expect(url).toContain('%2F');
  });

  it('returns /overlaps with no param when skillIdentity is empty string', () => {
    const url = buildOverlapsUrl('');
    expect(url).toBe('/overlaps');
  });
});

// ---------------------------------------------------------------------------
// buildInventorySearchUrl
// ---------------------------------------------------------------------------

describe('buildInventorySearchUrl', () => {
  it('returns / with a search param for a given skill name', () => {
    const url = buildInventorySearchUrl('code-review');
    expect(url).toBe('/?search=code-review');
  });

  it('handles skill names with spaces', () => {
    const url = buildInventorySearchUrl('my skill');
    expect(url).toBe('/?search=my+skill');
  });

  it('returns / with no param when skillName is empty string', () => {
    const url = buildInventorySearchUrl('');
    expect(url).toBe('/');
  });

  it('handles skill names that are full file paths (uses basename)', () => {
    const url = buildInventorySearchUrl('lint.md');
    expect(url).toBe('/?search=lint.md');
  });
});

// ---------------------------------------------------------------------------
// parseSearchParam
// ---------------------------------------------------------------------------

describe('parseSearchParam', () => {
  it('returns the search string when present', () => {
    expect(parseSearchParam('code-review')).toBe('code-review');
  });

  it('returns empty string for null', () => {
    expect(parseSearchParam(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(parseSearchParam(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(parseSearchParam('')).toBe('');
  });

  it('trims whitespace from the param', () => {
    expect(parseSearchParam('  code-review  ')).toBe('code-review');
  });
});
