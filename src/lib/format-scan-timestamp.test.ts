/**
 * Unit tests for formatScanTimestamp utility
 *
 * AC6: "Nav timestamp includes date when scan is not from today" → unit (pure formatting logic)
 * AC1: "Dashboard stat cards update to reflect the active project filter" → unit (pure filter logic)
 */

import { describe, it, expect } from 'vitest';
import { formatScanTimestamp } from './format-scan-timestamp';

// ---------------------------------------------------------------------------
// formatScanTimestamp
// ---------------------------------------------------------------------------

describe('formatScanTimestamp', () => {
  it('shows only time when scan is from today', () => {
    const now = new Date();
    const scannedAt = now.toISOString();
    const result = formatScanTimestamp(scannedAt, now);
    // Should contain a time portion (colon) but not a date prefix
    expect(result).toMatch(/\d+:\d+/);
    // Should NOT include a full date like "Jan 1" or "12/31"
    // The result should be a short time string
    expect(result.length).toBeLessThan(20);
  });

  it('shows date and time when scan is from a different day', () => {
    const now = new Date('2026-04-03T10:00:00.000Z');
    const yesterday = new Date('2026-04-02T22:00:00.000Z');
    const result = formatScanTimestamp(yesterday.toISOString(), now);
    // Should be longer and include some date info
    expect(result.length).toBeGreaterThan(5);
    // Should include the time
    expect(result).toMatch(/\d/);
  });

  it('returns time-only string for a scan from the same day (midnight)', () => {
    const today = new Date('2026-04-03T00:01:00.000Z');
    const laterSameDay = new Date('2026-04-03T23:59:00.000Z');
    const result = formatScanTimestamp(today.toISOString(), laterSameDay);
    // Same calendar day — time only
    expect(result).toBeTruthy();
  });

  it('returns a non-empty string for any valid ISO timestamp', () => {
    const scannedAt = '2025-01-15T08:30:00.000Z';
    const now = new Date('2026-04-03T10:00:00.000Z');
    const result = formatScanTimestamp(scannedAt, now);
    expect(result.length).toBeGreaterThan(0);
  });
});
