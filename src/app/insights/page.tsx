"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { DiffView } from "@/components/diff-view";
import { skillIdentityKey } from "@/lib/analyzer/overlaps";
import type { GapFlag, ContradictionFlag, SkillFile, OverlapCluster } from "@/lib/types";
import type { AnalyzeResponse, AnalyzeErrorResponse } from "@/app/api/analyze/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SeverityFilter = "all" | "warning" | "info";

type ScanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      gaps: GapFlag[];
      contradictions: ContradictionFlag[];
      allFiles: SkillFile[];
      scannedAt: string;
      durationMs: number;
    };

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: ContradictionFlag["severity"] }) {
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20">
        warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-inset ring-blue-600/20">
      info
    </span>
  );
}

// ---------------------------------------------------------------------------
// GapCard — one card per GapFlag
// ---------------------------------------------------------------------------

interface GapCardProps {
  gap: GapFlag;
  allFiles: SkillFile[];
}

function GapCard({ gap, allFiles }: GapCardProps) {
  // Find an existing copy to offer "Open in Editor"
  const existingFile = allFiles.find(
    (f) =>
      f.filePath.endsWith(gap.skillName) &&
      gap.presentIn.some((p) => p.projectName === f.projectName)
  );

  function handleOpen() {
    if (!existingFile) return;
    void fetch(
      `/api/open?path=${encodeURIComponent(existingFile.filePath)}`
    );
  }

  return (
    <Card className="border border-amber-200 dark:border-amber-800/50">
      <CardHeader className="border-b">
        <CardTitle className="font-mono text-sm">{gap.skillName}</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">{gap.coverage}</span>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-3">
        {/* Present in */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Present in</p>
          <ul className="flex flex-wrap gap-1.5">
            {gap.presentIn.map((p) => (
              <li
                key={p.projectName}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              >
                {p.projectName}
              </li>
            ))}
          </ul>
        </div>

        {/* Missing from */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Missing from</p>
          <ul className="flex flex-wrap gap-1.5">
            {gap.missingFrom.map((p) => (
              <li
                key={p.projectName}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                {p.projectName}
              </li>
            ))}
          </ul>
        </div>

        {/* Action hint */}
        {existingFile && (
          <div className="pt-1">
            <button
              onClick={handleOpen}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              title={existingFile.filePath}
            >
              Open in Editor
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ContradictionCard — one card per ContradictionFlag
// ---------------------------------------------------------------------------

interface ContradictionCardProps {
  contradiction: ContradictionFlag;
  allFiles: SkillFile[];
  onViewDiff: (files: SkillFile[], filename: string) => void;
}

function ContradictionCard({ contradiction, allFiles, onViewDiff }: ContradictionCardProps) {
  // Collect all unique serialized values for color-coding
  const uniqueValues = Array.from(
    new Set(contradiction.values.map((v) => JSON.stringify(v.value)))
  );

  // Assign a color class per unique value index (cycle through palette)
  const colorPalette = [
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  ];

  function colorFor(value: unknown): string {
    const idx = uniqueValues.indexOf(JSON.stringify(value));
    return colorPalette[idx % colorPalette.length] ?? colorPalette[0];
  }

  // skillName is now a skill identity key (parentDir/filename or filename).
  // Match files using skillIdentityKey() so we correctly pair files from the
  // same skill, even when the filename alone is generic (e.g. SKILL.md).
  const involvedFiles = allFiles.filter(
    (f) =>
      skillIdentityKey(f.filePath) === contradiction.skillName &&
      contradiction.values.some(
        (v) =>
          v.projectName === (f.projectName ?? "(user)") &&
          v.level === f.level
      )
  );

  function handleViewDiff() {
    if (involvedFiles.length >= 2) {
      onViewDiff(involvedFiles, contradiction.skillName);
    }
  }

  return (
    <Card
      className={
        contradiction.severity === "warning"
          ? "border border-amber-200 dark:border-amber-800/50"
          : "border border-blue-200 dark:border-blue-800/50"
      }
    >
      <CardHeader className="border-b">
        <CardTitle className="font-mono text-sm">{contradiction.skillName}</CardTitle>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{contradiction.field}</span>
          <SeverityBadge severity={contradiction.severity} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-3">
        <p className="text-xs text-muted-foreground">
          Field <code className="font-mono">{contradiction.field}</code> has different values across copies:
        </p>

        {/* Value rows with color coding */}
        <ul className="flex flex-col gap-1.5">
          {contradiction.values.map((entry, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-28 truncate" title={entry.projectName}>
                {entry.projectName}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono font-medium ${colorFor(entry.value)}`}
              >
                {String(entry.value)}
              </span>
            </li>
          ))}
        </ul>

        {/* View diff button */}
        {involvedFiles.length >= 2 && (
          <div className="pt-1">
            <button
              onClick={handleViewDiff}
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
// DiffModal — reused from overlaps page pattern
// ---------------------------------------------------------------------------

interface DiffModalProps {
  files: SkillFile[];
  filename: string;
  onClose: () => void;
}

function DiffModal({ files, filename, onClose }: DiffModalProps) {
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Build a synthetic cluster-like object for status badge
  const allSameHash = files.every((f) => f.contentHash === files[0].contentHash);
  const status: OverlapCluster["status"] = allSameHash ? "identical" : "drifted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Diff view for ${filename}`}
    >
      <div className="relative flex flex-col w-full max-w-6xl h-[80vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{filename}</span>
            <span
              className={
                status === "drifted"
                  ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20"
                  : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-inset ring-green-600/20"
              }
            >
              {status}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              {files.length} cop{files.length === 1 ? "y" : "ies"}
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
          <DiffView files={files} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsightsPage — main page component
// ---------------------------------------------------------------------------

export default function InsightsPage() {
  const [scan, setScan] = React.useState<ScanState>({ status: "loading" });
  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>("all");
  const [activeDiff, setActiveDiff] = React.useState<{
    files: SkillFile[];
    filename: string;
  } | null>(null);

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

        // Flatten all files for lookup (needed by gap + contradiction cards)
        const allFiles: SkillFile[] = [
          ...data.projects.flatMap((p) => p.skills),
          ...data.userSkills,
          ...data.pluginSkills,
        ];

        setScan({
          status: "ok",
          gaps: data.gaps,
          contradictions: data.contradictions,
          allFiles,
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

  // Derived filtered contradictions
  const visibleContradictions = React.useMemo(() => {
    if (scan.status !== "ok") return [];
    if (severityFilter === "all") return scan.contradictions;
    return scan.contradictions.filter((c) => c.severity === severityFilter);
  }, [scan, severityFilter]);

  const visibleGaps = scan.status === "ok" ? scan.gaps : [];

  function handleViewDiff(files: SkillFile[], filename: string) {
    setActiveDiff({ files, filename });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">

          {/* Loading */}
          {scan.status === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="text-sm">Analyzing gaps and contradictions…</p>
            </div>
          )}

          {/* Error */}
          {scan.status === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              <strong>Analysis failed:</strong> {scan.message}
            </div>
          )}

          {/* OK */}
          {scan.status === "ok" && (
            <>
              {/* Summary stats */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-2.5">
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {scan.gaps.length}
                  </span>
                  <span className="text-sm text-amber-700/80 dark:text-amber-400/80">
                    gap{scan.gaps.length !== 1 ? "s" : ""} found
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 px-4 py-2.5">
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {scan.contradictions.length}
                  </span>
                  <span className="text-sm text-blue-700/80 dark:text-blue-400/80">
                    contradiction{scan.contradictions.length !== 1 ? "s" : ""} found
                  </span>
                </div>
                <p className="ml-auto text-xs text-muted-foreground">
                  Scanned in {scan.durationMs}ms &middot;{" "}
                  {new Date(scan.scannedAt).toLocaleTimeString()}
                </p>
              </div>

              {/* ----------------------------------------------------------------
                  Gaps section
              ---------------------------------------------------------------- */}
              <section aria-labelledby="gaps-heading">
                <h2 id="gaps-heading" className="text-base font-semibold mb-3">
                  Gaps
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    Skills present in some projects but missing from others
                  </span>
                </h2>

                {visibleGaps.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                    <p className="font-medium text-base mb-1">No gaps found</p>
                    <p>
                      Skills present in ≥2 projects (or ≥50% for larger workspaces) but missing
                      from others will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleGaps.map((gap) => (
                      <GapCard
                        key={gap.skillName}
                        gap={gap}
                        allFiles={scan.allFiles}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ----------------------------------------------------------------
                  Contradictions section
              ---------------------------------------------------------------- */}
              <section aria-labelledby="contradictions-heading">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <h2 id="contradictions-heading" className="text-base font-semibold">
                    Contradictions
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      Frontmatter field mismatches across copies of the same skill
                    </span>
                  </h2>

                  {/* Severity filter with tooltips explaining each level */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSeverityFilter("all")}
                      className={
                        severityFilter === "all"
                          ? "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background transition-colors"
                          : "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                      }
                    >
                      All ({scan.contradictions.length})
                    </button>
                    <button
                      onClick={() => setSeverityFilter("warning")}
                      title="Warning: model or effort fields differ — these settings affect behaviour significantly"
                      className={
                        severityFilter === "warning"
                          ? "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background transition-colors"
                          : "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                      }
                    >
                      Warning ({scan.contradictions.filter((c) => c.severity === "warning").length})
                    </button>
                    <button
                      onClick={() => setSeverityFilter("info")}
                      title="Info: allowed-tools or user-invocable fields differ — lower impact mismatches"
                      className={
                        severityFilter === "info"
                          ? "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background transition-colors"
                          : "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                      }
                    >
                      Info ({scan.contradictions.filter((c) => c.severity === "info").length})
                    </button>
                  </div>
                </div>

                {visibleContradictions.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                    {scan.contradictions.length === 0 ? (
                      <>
                        <p className="font-medium text-base mb-1">No contradictions found</p>
                        <p>
                          Frontmatter fields (model, effort, allowed-tools, user-invocable) that
                          differ across copies of the same skill will appear here.
                        </p>
                      </>
                    ) : (
                      <p>No {severityFilter} contradictions found.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleContradictions.map((contradiction, i) => (
                      <ContradictionCard
                        key={`${contradiction.skillName}-${contradiction.field}-${i}`}
                        contradiction={contradiction}
                        allFiles={scan.allFiles}
                        onViewDiff={handleViewDiff}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {/* Diff modal */}
      {activeDiff !== null && (
        <DiffModal
          files={activeDiff.files}
          filename={activeDiff.filename}
          onClose={() => setActiveDiff(null)}
        />
      )}
    </div>
  );
}
