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
    // Use dates far enough apart that timezone offsets won't collapse them
    // into the same local calendar day
    const now = new Date(2026, 3, 3, 12, 0, 0);        // Apr 3 noon local
    const twoDaysAgo = new Date(2026, 3, 1, 12, 0, 0); // Apr 1 noon local
    const result = formatScanTimestamp(twoDaysAgo.toISOString(), now);
    // Should contain a month/day date portion (e.g. "Apr 1" or locale equivalent)
    expect(result).toMatch(/[A-Za-z]+\s+\d+|\d{1,2}[\/\-\.]\d{1,2}/);
    // Should also include a time portion with colon
    expect(result).toMatch(/\d+:\d+/);
  });

  it('returns time-only string for a scan from the same day (midnight)', () => {
    // Construct both dates using local time so they are guaranteed to share
    // the same calendar day regardless of system timezone
    const earlyMorning = new Date(2026, 3, 3, 0, 1, 0);  // Apr 3 00:01 local
    const lateEvening  = new Date(2026, 3, 3, 23, 59, 0); // Apr 3 23:59 local
    const result = formatScanTimestamp(earlyMorning.toISOString(), lateEvening);
    // Same calendar day — should be a time-only string with colon separators
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    // Should NOT contain a month name or date separator (no "Apr", "Jan", "/", etc.)
    expect(result).not.toMatch(/[A-Za-z]{3,}\s+\d+/);
  });

  it('returns a non-empty string for any valid ISO timestamp', () => {
    const scannedAt = '2025-01-15T08:30:00.000Z';
    const now = new Date('2026-04-03T10:00:00.000Z');
    const result = formatScanTimestamp(scannedAt, now);
    expect(result.length).toBeGreaterThan(0);
  });
});
