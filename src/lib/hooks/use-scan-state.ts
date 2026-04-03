"use client";

/**
 * useScanState — encapsulates scan + analyze API calls, state management,
 * and registerScan() integration for the inventory page.
 *
 * Extracted from src/app/page.tsx to reduce page component complexity.
 *
 * Key design decisions:
 * - /api/scan and /api/analyze are called in parallel via Promise.all
 * - The stable ref pattern prevents stale-closure issues in the rescan callback
 * - registerScan() is called at each state transition to keep the NavBar in sync
 */

import * as React from "react";
import { useScanContext } from "@/components/scan-context";
import { deduplicateSkills } from "@/lib/skills";
import type { SkillFile } from "@/lib/types";
import type { ScanResponse, ScanErrorResponse } from "@/app/api/scan/route";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal project info needed for the CLAUDE.md viewer. */
export interface ProjectRef {
  name: string;
  path: string;
}

export interface DashboardStats {
  totalSkills: number;
  overlaps: number;
  gaps: number;
  contradictions: number;
  /** Skill identity keys that have at least one overlap cluster. */
  overlapIdentities: Set<string>;
}

export type ScanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      skills: SkillFile[];
      projects: ProjectRef[];
      scannedAt: string;
      durationMs: number;
      stats: DashboardStats | null;
    };

// ---------------------------------------------------------------------------
// Public API surface types (re-exported for tests)
// ---------------------------------------------------------------------------

export type ScanApiResult = ScanResponse;
export type AnalyzeApiResult = AnalyzeResponse;

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testability)
// ---------------------------------------------------------------------------

/** Build the /api/scan URL with optional additionalPaths query param. */
export function buildScanUrl(paths: string[]): string {
  if (paths.length === 0) return "/api/scan";
  return `/api/scan?additionalPaths=${encodeURIComponent(paths.join(","))}`;
}

/** Build the /api/analyze URL with optional additionalPaths query param. */
export function buildAnalyzeUrl(paths: string[]): string {
  if (paths.length === 0) return "/api/analyze";
  return `/api/analyze?additionalPaths=${encodeURIComponent(paths.join(","))}`;
}

/**
 * Process the parallel responses from /api/scan and /api/analyze into a
 * unified ScanState.
 *
 * Exported for unit testing — the hook calls this internally.
 */
export async function processParallelResponses(
  scanRes: Response,
  analyzeRes: Response
): Promise<
  | { status: "error"; message: string }
  | {
      status: "ok";
      skills: SkillFile[];
      projects: ProjectRef[];
      scannedAt: string;
      durationMs: number;
      stats: DashboardStats | null;
    }
> {
  // Scan must succeed — if not, return error immediately
  if (!scanRes.ok) {
    const errBody = (await scanRes.json()) as ScanErrorResponse;
    return { status: "error", message: errBody.error };
  }

  const scanData = (await scanRes.json()) as ScanResponse;

  const allSkills: SkillFile[] = deduplicateSkills([
    ...scanData.projects.flatMap((p) => p.skills),
    ...scanData.userSkills,
    ...scanData.pluginSkills,
  ]);

  // Analyze is best-effort — failure just means no stats
  let stats: DashboardStats | null = null;
  if (analyzeRes.ok) {
    const analyzeData = (await analyzeRes.json()) as AnalyzeResponse;
    stats = {
      totalSkills: allSkills.length,
      overlaps: analyzeData.clusters.length,
      gaps: analyzeData.gaps.length,
      contradictions: analyzeData.contradictions.length,
      overlapIdentities: new Set(analyzeData.clusters.map((c) => c.skillIdentity)),
    };
  }

  return {
    status: "ok",
    skills: allSkills,
    projects: scanData.projects.map((p) => ({ name: p.name, path: p.path })),
    scannedAt: scanData.scannedAt,
    durationMs: scanData.scanDurationMs,
    stats,
  };
}

/**
 * Run both API calls in parallel using Promise.all.
 *
 * Exported for unit testing — verifies both fetches are initiated concurrently.
 */
export async function runParallelFetch(
  paths: string[]
): Promise<[Response, Response]> {
  return Promise.all([fetch(buildScanUrl(paths)), fetch(buildAnalyzeUrl(paths))]);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useScanState manages all scan-related state for the inventory page.
 *
 * - Triggers a scan on mount and whenever additionalPaths changes
 * - Calls /api/scan and /api/analyze in parallel via Promise.all
 * - Exposes scan state (loading / error / ok) and a manual rescan trigger
 * - Keeps the NavBar in sync by calling registerScan() at each transition
 *
 * @param additionalPaths - extra directories to include in the scan (from useAdditionalPaths)
 */
export function useScanState(additionalPaths: string[]): ScanState {
  const { registerScan } = useScanContext();
  const [scan, setScan] = React.useState<ScanState>({ status: "loading" });

  // Stable ref so the rescan callback always calls the current runScan
  // without creating circular dependencies in useCallback/useEffect.
  const runScanRef = React.useRef<((paths: string[]) => Promise<void>) | undefined>(
    undefined
  );

  const runScan = React.useCallback(
    async (paths: string[]) => {
      setScan({ status: "loading" });

      registerScan({
        scannedAt: null,
        scanning: true,
        rescan: () => {
          void runScanRef.current?.(paths);
        },
      });

      try {
        const [scanRes, analyzeRes] = await runParallelFetch(paths);
        const result = await processParallelResponses(scanRes, analyzeRes);

        if (result.status === "error") {
          setScan({ status: "error", message: result.message });
          registerScan({
            scannedAt: null,
            scanning: false,
            rescan: () => {
              void runScanRef.current?.(paths);
            },
          });
          return;
        }

        setScan({
          status: "ok",
          skills: result.skills,
          projects: result.projects,
          scannedAt: result.scannedAt,
          durationMs: result.durationMs,
          stats: result.stats,
        });

        registerScan({
          scannedAt: result.scannedAt,
          scanning: false,
          rescan: () => {
            void runScanRef.current?.(paths);
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setScan({ status: "error", message });
        registerScan({
          scannedAt: null,
          scanning: false,
          rescan: () => {
            void runScanRef.current?.(paths);
          },
        });
      }
    },
    [registerScan]
  );

  // Keep the ref in sync with the latest runScan callback
  React.useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  // Trigger a scan on mount and whenever additionalPaths changes
  React.useEffect(() => {
    void runScan(additionalPaths);
  }, [additionalPaths, runScan]);

  return scan;
}
