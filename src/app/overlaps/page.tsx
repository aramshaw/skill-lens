"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { DiffView } from "@/components/diff-view";
import type { OverlapCluster, SkillFile } from "@/lib/types";
import type { AnalyzeResponse, AnalyzeErrorResponse } from "@/app/api/analyze/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterMode = "all" | "drifted" | "identical";

type ScanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; clusters: OverlapCluster[]; scannedAt: string; durationMs: number };

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: OverlapCluster["status"] }) {
  if (status === "drifted") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20">
        drifted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-inset ring-green-600/20">
      identical
    </span>
  );
}

// ---------------------------------------------------------------------------
// Location label for a single SkillFile
// ---------------------------------------------------------------------------

function locationLabel(skill: SkillFile): string {
  if (skill.level === "user") return "~/.claude (user)";
  if (skill.level === "plugin") return "plugin";
  return skill.projectName ?? skill.filePath;
}

// ---------------------------------------------------------------------------
// ClusterCard — one card per overlap cluster
// ---------------------------------------------------------------------------

interface ClusterCardProps {
  cluster: OverlapCluster;
  onOpenDiff: (cluster: OverlapCluster) => void;
}

function ClusterCard({ cluster, onOpenDiff }: ClusterCardProps) {
  const isDrifted = cluster.status === "drifted";

  return (
    <Card
      className={
        isDrifted
          ? "border border-amber-200 dark:border-amber-800/50"
          : "border border-border"
      }
    >
      <CardHeader className="border-b">
        <CardTitle className="font-mono text-sm">{cluster.filename}</CardTitle>
        <CardAction>
          <StatusBadge status={cluster.status} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-3">
        {/* Copy count summary */}
        <p className="text-xs text-muted-foreground">
          {cluster.files.length} cop{cluster.files.length === 1 ? "y" : "ies"}
          {isDrifted && (
            <span className="ml-2 text-amber-700 dark:text-amber-400 font-medium">
              — content has diverged across locations
            </span>
          )}
        </p>

        {/* Location list */}
        <ul className="flex flex-col gap-1">
          {cluster.files.map((file) => (
            <li
              key={file.filePath}
              className="flex items-center gap-2 text-xs"
              title={file.filePath}
            >
              {/* Level badge */}
              <span
                className={
                  file.level === "user"
                    ? "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 shrink-0"
                    : file.level === "plugin"
                      ? "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 shrink-0"
                      : "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0"
                }
              >
                {file.level}
              </span>
              <span className="truncate text-muted-foreground font-mono">
                {locationLabel(file)}
              </span>
            </li>
          ))}
        </ul>

        {/* Diff button — only shown when there are 2+ files to compare */}
        {cluster.files.length >= 2 && (
          <div className="pt-1">
            <button
              onClick={() => onOpenDiff(cluster)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              View diff
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DiffModal — overlay showing DiffView for a selected cluster
// ---------------------------------------------------------------------------

interface DiffModalProps {
  cluster: OverlapCluster;
  onClose: () => void;
}

function DiffModal({ cluster, onClose }: DiffModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Diff view for ${cluster.filename}`}
    >
      <div className="relative flex flex-col w-full max-w-6xl h-[80vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {cluster.filename}
            </span>
            <StatusBadge status={cluster.status} />
            <span className="text-xs text-muted-foreground ml-1">
              {cluster.files.length} cop{cluster.files.length === 1 ? "y" : "ies"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none ml-4"
            aria-label="Close diff view"
          >
            ×
          </button>
        </div>

        {/* DiffView fills remaining height */}
        <div className="flex-1 min-h-0 p-4">
          <DiffView files={cluster.files} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverlapsPage — main page component
// ---------------------------------------------------------------------------

export default function OverlapsPage() {
  const [scan, setScan] = React.useState<ScanState>({ status: "loading" });
  const [filter, setFilter] = React.useState<FilterMode>("all");
  const [activeDiff, setActiveDiff] = React.useState<OverlapCluster | null>(null);

  React.useEffect(() => {
    async function runAnalyze() {
      try {
        const res = await fetch("/api/analyze");
        if (!res.ok) {
          const errBody = (await res.json()) as AnalyzeErrorResponse;
          setScan({ status: "error", message: errBody.error });
          return;
        }
        const data = (await res.json()) as AnalyzeResponse;
        setScan({
          status: "ok",
          clusters: data.clusters,
          scannedAt: data.scannedAt,
          durationMs: data.scanDurationMs,
        });
      } catch (err) {
        setScan({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    void runAnalyze();
  }, []);

  // Derived: apply filter
  const visibleClusters = React.useMemo(() => {
    if (scan.status !== "ok") return [];
    if (filter === "all") return scan.clusters;
    return scan.clusters.filter((c) => c.status === filter);
  }, [scan, filter]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Skill Lens</h1>
          <span className="text-sm text-muted-foreground">
            Overlap clusters
          </span>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Inventory
            </Link>
            <span className="text-foreground font-medium">Overlaps</span>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Loading state */}
          {scan.status === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="text-sm">Analyzing overlaps…</p>
            </div>
          )}

          {/* Error state */}
          {scan.status === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              <strong>Analysis failed:</strong> {scan.message}
            </div>
          )}

          {/* OK state */}
          {scan.status === "ok" && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {/* Filter buttons */}
                  {(["all", "drifted", "identical"] as FilterMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        onClick={() => setFilter(mode)}
                        className={
                          filter === mode
                            ? "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background transition-colors"
                            : "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                        }
                      >
                        {mode === "all"
                          ? `All (${scan.clusters.length})`
                          : mode === "drifted"
                            ? `Drifted (${scan.clusters.filter((c) => c.status === "drifted").length})`
                            : `Identical (${scan.clusters.filter((c) => c.status === "identical").length})`}
                      </button>
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scanned in {scan.durationMs}ms &middot;{" "}
                  {new Date(scan.scannedAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Empty state — no overlaps found at all */}
              {scan.clusters.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/20 px-5 py-14 text-center text-sm text-muted-foreground">
                  <p className="font-medium text-base mb-1">No overlaps found</p>
                  <p>
                    Skills that share a filename across two or more locations
                    will appear here.
                  </p>
                </div>
              )}

              {/* Empty state — filter produced no results but clusters exist */}
              {scan.clusters.length > 0 && visibleClusters.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                  No {filter} clusters found.
                </div>
              )}

              {/* Cluster grid */}
              {visibleClusters.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleClusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.filename}
                      cluster={cluster}
                      onOpenDiff={setActiveDiff}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Diff modal */}
      {activeDiff !== null && (
        <DiffModal
          cluster={activeDiff}
          onClose={() => setActiveDiff(null)}
        />
      )}
    </div>
  );
}
