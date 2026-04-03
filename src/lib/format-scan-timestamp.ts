/**
 * Formats a scan timestamp for display in the nav bar.
 *
 * - If the scan is from today (same calendar day as `now`), returns a short time string only.
 * - If the scan is from a different day, returns a date + time string.
 *
 * Both values are formatted in the user's locale.
 *
 * @param scannedAt ISO 8601 string from the scan API
 * @param now       Current date (defaults to `new Date()`, injectable for testing)
 */
export function formatScanTimestamp(
  scannedAt: string,
  now: Date = new Date()
): string {
  const scanned = new Date(scannedAt);

  const isSameDay =
    scanned.getFullYear() === now.getFullYear() &&
    scanned.getMonth() === now.getMonth() &&
    scanned.getDate() === now.getDate();

  if (isSameDay) {
    return scanned.toLocaleTimeString();
  }

  // Different day — include a short date
  return scanned.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: scanned.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }) + " " + scanned.toLocaleTimeString();
}
