"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InventoryTable } from "@/components/inventory-table";
import { ProjectSidebar } from "@/components/project-sidebar";
import { ClaudeMdViewer } from "@/components/claude-md-viewer";
import { SettingsPanel, loadAdditionalPaths } from "@/components/settings-panel";
import { useScanContext } from "@/components/scan-context";
import { parseSearchParam } from "@/lib/cross-page-nav";
import type { ProjectFilter } from "@/components/project-sidebar";
import type { SkillFile } from "@/lib/types";
import type { ScanResponse, ScanErrorResponse } from "@/app/api/scan/route";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import { deduplicateSkills } from "@/lib/skills";

/** Minimal project info needed to look up paths for the CLAUDE.md viewer. */
interface ProjectRef {
  name: string;
  path: string;
}

type ScanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; skills: SkillFile[]; projects: ProjectRef[]; scannedAt: string; durationMs: number };

interface DashboardStats {
  totalSkills: number;
  overlaps: number;
  gaps: number;
  contradictions: number;
  /** Skill identity keys that have at least one overlap cluster. */
  overlapIdentities: Set<string>;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  href: string;
  colorClass: string;
}

function StatCard({ label, value, href, colorClass }: StatCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-border bg-card px-5 py-4 hover:bg-muted/40 transition-colors"
    >
      <span className={`text-3xl font-bold tabular-nums ${colorClass}`}>{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { registerScan } = useScanContext();
  const searchParams = useSearchParams();
  const initialSearch = parseSearchParam(searchParams.get("search"));
  const [scan, setScan] = React.useState<ScanState>({ status: "loading" });
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [projectFilter, setProjectFilter] = React.useState<ProjectFilter>(null);
  const [additionalPaths, setAdditionalPaths] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Load additional paths from localStorage on mount
  React.useEffect(() => {
    setAdditionalPaths(loadAdditionalPaths());
  }, []);

  // Stable ref so the rescan callback passed to registerScan always calls
  // the current version of runScan without self-referential dependency issues.
  const runScanRef = React.useRef<((paths: string[]) => Promise<void>) | undefined>(undefined);

  const runScan = React.useCallback(async (paths: string[]) => {
    setScan({ status: "loading" });

    // Register loading state with the nav bar (use stable ref for rescan)
    registerScan({
      scannedAt: null,
      scanning: true,
      rescan: () => { void runScanRef.current?.(paths); },
    });

    try {
      const url =
        paths.length > 0
          ? `/api/scan?additionalPaths=${encodeURIComponent(paths.join(","))}`
          : "/api/scan";
      const res = await fetch(url);
      if (!res.ok) {
        const errBody = (await res.json()) as ScanErrorResponse;
        setScan({ status: "error", message: errBody.error });
        registerScan({
          scannedAt: null,
          scanning: false,
          rescan: () => { void runScanRef.current?.(paths); },
        });
        return;
      }
      const data = (await res.json()) as ScanResponse;

      // Flatten all skills from all levels and deduplicate by filePath.
      // The server-side scanner already deduplicates project skills against
      // user/plugin skills, but we apply a second pass here as a safety net
      // in case any additional sources introduce the same physical file.
      const allSkills: SkillFile[] = deduplicateSkills([
        ...data.projects.flatMap((p) => p.skills),
        ...data.userSkills,
        ...data.pluginSkills,
      ]);

      setScan({
        status: "ok",
        skills: allSkills,
        projects: data.projects.map((p) => ({ name: p.name, path: p.path })),
        scannedAt: data.scannedAt,
        durationMs: data.scanDurationMs,
      });

      // Fetch analyze stats for dashboard summary
      const analyzeUrl =
        paths.length > 0
          ? `/api/analyze?additionalPaths=${encodeURIComponent(paths.join(","))}`
          : "/api/analyze";
      const analyzeRes = await fetch(analyzeUrl);
      if (analyzeRes.ok) {
        const analyzeData = (await analyzeRes.json()) as AnalyzeResponse;
        setStats({
          totalSkills: allSkills.length,
          overlaps: analyzeData.clusters.length,
          gaps: analyzeData.gaps.length,
          contradictions: analyzeData.contradictions.length,
          overlapIdentities: new Set(analyzeData.clusters.map((c) => c.skillIdentity)),
        });
      }

      registerScan({
        scannedAt: data.scannedAt,
        scanning: false,
        rescan: () => { void runScanRef.current?.(paths); },
      });
    } catch (err) {
      setScan({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      registerScan({
        scannedAt: null,
        scanning: false,
        rescan: () => { void runScanRef.current?.(paths); },
      });
    }
  }, [registerScan]);

  // Keep the ref in sync with the latest runScan
  React.useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  // Run scan on mount and whenever additionalPaths changes
  React.useEffect(() => {
    void runScan(additionalPaths);
  }, [additionalPaths, runScan]);

  function handlePathsChange(paths: string[]) {
    setAdditionalPaths(paths);
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Settings panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onPathsChange={handlePathsChange}
      />

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {scan.status === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="text-sm">Scanning projects…</p>
            </div>
          )}

          {scan.status === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              <strong>Scan failed:</strong> {scan.message}
            </div>
          )}

          {scan.status === "ok" && (
            <>
              {/* Dashboard summary stats */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Total skills"
                    value={stats.totalSkills}
                    href="/"
                    colorClass="text-foreground"
                  />
                  <StatCard
                    label="Overlaps"
                    value={stats.overlaps}
                    href="/overlaps"
                    colorClass="text-amber-600 dark:text-amber-400"
                  />
                  <StatCard
                    label="Gaps"
                    value={stats.gaps}
                    href="/insights"
                    colorClass="text-orange-600 dark:text-orange-400"
                  />
                  <StatCard
                    label="Contradictions"
                    value={stats.contradictions}
                    href="/insights"
                    colorClass="text-blue-600 dark:text-blue-400"
                  />
                </div>
              )}

              {/* Scan meta + settings */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {scan.skills.length} file
                  {scan.skills.length !== 1 ? "s" : ""} scanned in{" "}
                  {scan.durationMs}ms
                </p>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Manage scan paths
                </button>
              </div>

              {scan.skills.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                  No skill files found. Add some skills to{" "}
                  <code className="font-mono text-xs">~/.claude/skills/</code>{" "}
                  or a project&apos;s{" "}
                  <code className="font-mono text-xs">.claude/skills/</code>{" "}
                  directory.
                </div>
              ) : (
                /* Sidebar + table layout */
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <ProjectSidebar
                    skills={scan.skills}
                    projects={scan.projects}
                    activeFilter={projectFilter}
                    onFilterChange={setProjectFilter}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-4">
                    <InventoryTable
                      skills={scan.skills}
                      projectFilter={projectFilter}
                      initialSearch={initialSearch}
                      overlapIdentities={stats?.overlapIdentities}
                    />
                    {/* CLAUDE.md viewer — shown when a specific project is selected */}
                    {projectFilter !== null &&
                      projectFilter !== "__user__" &&
                      projectFilter !== "__plugin__" && (() => {
                        const proj = scan.projects.find(
                          (p) => p.name === projectFilter
                        );
                        return (
                          <ClaudeMdViewer
                            projectPath={proj?.path ?? null}
                            projectName={proj?.name ?? projectFilter}
                          />
                        );
                      })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
