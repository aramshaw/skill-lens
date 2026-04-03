'use client';

/**
 * Home page — fetches scan results and renders the inventory table.
 */

import * as React from 'react';
import { InventoryTable } from '@/components/inventory-table';
import type { ScanResult } from '@/lib/types';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all SkillFiles from a ScanResult into a single flat list. */
function flattenSkills(result: ScanResult): SkillFile[] {
  const projectSkills = result.projects.flatMap((p) => p.skills);
  return [...projectSkills, ...result.userSkills, ...result.pluginSkills];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [skills, setSkills] = React.useState<SkillFile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scannedAt, setScannedAt] = React.useState<string | null>(null);
  const [scanDurationMs, setScanDurationMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function runScan() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/scan');
        const data = (await response.json()) as ScanResult & {
          scanDurationMs: number;
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setError(data.error ?? 'Scan failed');
          return;
        }

        setSkills(flattenSkills(data));
        setScannedAt(data.scannedAt);
        setScanDurationMs(data.scanDurationMs);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void runScan();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Skill Lens</h1>
            <p className="text-xs text-muted-foreground">
              Claude Code skill inventory across all projects
            </p>
          </div>
          {scannedAt && (
            <p className="text-xs text-muted-foreground">
              Scanned {new Date(scannedAt).toLocaleTimeString()} &middot;{' '}
              {scanDurationMs}ms
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Scan error:</strong> {error}
          </div>
        ) : (
          <InventoryTable skills={skills} loading={loading} />
        )}
      </main>
    </div>
  );
}
