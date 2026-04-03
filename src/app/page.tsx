"use client";

import * as React from "react";
import type { ScanResponse, ScanErrorResponse } from "@/app/api/scan/route";
import type { SkillFile } from "@/lib/types";
import { InventoryTable } from "@/components/inventory-table";

export default function Home() {
  const [skills, setSkills] = React.useState<SkillFile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scannedAt, setScannedAt] = React.useState<string | undefined>();
  const [scanDurationMs, setScanDurationMs] = React.useState<
    number | undefined
  >();

  React.useEffect(() => {
    let cancelled = false;

    async function fetchScan() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/scan");
        const json = (await res.json()) as ScanResponse | ScanErrorResponse;

        if (cancelled) return;

        if (!res.ok || "error" in json) {
          const errJson = json as ScanErrorResponse;
          setError(errJson.error ?? "Scan failed");
          setSkills([]);
          return;
        }

        const data = json as ScanResponse;
        const allSkills: SkillFile[] = [
          ...data.userSkills,
          ...data.pluginSkills,
          ...data.projects.flatMap((p) => p.skills),
        ];

        setSkills(allSkills);
        setScannedAt(data.scannedAt);
        setScanDurationMs(data.scanDurationMs);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error");
        setSkills([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchScan();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Skill Lens</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualize and analyze Claude Code skills across all your projects.
        </p>
      </header>

      <main className="flex-1 px-6 py-6 max-w-screen-2xl w-full mx-auto">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Scan error:</strong> {error}
          </div>
        ) : (
          <InventoryTable
            data={skills}
            loading={loading}
            scannedAt={scannedAt}
            scanDurationMs={scanDurationMs}
          />
        )}
      </main>
    </div>
  );
}
