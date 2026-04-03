"use client";

import * as React from "react";
import { InventoryTable } from "@/components/inventory-table";
import { ProjectSidebar } from "@/components/project-sidebar";
import { ClaudeMdViewer } from "@/components/claude-md-viewer";
import { SettingsPanel, loadAdditionalPaths } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import type { ProjectFilter } from "@/components/project-sidebar";
import type { SkillFile } from "@/lib/types";
import type { ScanResponse, ScanErrorResponse } from "@/app/api/scan/route";

/** Minimal project info needed to look up paths for the CLAUDE.md viewer. */
interface ProjectRef {
  name: string;
  path: string;
}

type ScanState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; skills: SkillFile[]; projects: ProjectRef[]; scannedAt: string; durationMs: number };

export default function Home() {
  const [scan, setScan] = React.useState<ScanState>({ status: "loading" });
  const [projectFilter, setProjectFilter] = React.useState<ProjectFilter>(null);
  const [additionalPaths, setAdditionalPaths] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Load additional paths from localStorage on mount
  React.useEffect(() => {
    setAdditionalPaths(loadAdditionalPaths());
  }, []);

  const runScan = React.useCallback(async (paths: string[]) => {
    setScan({ status: "loading" });
    try {
      const url =
        paths.length > 0
          ? `/api/scan?additionalPaths=${encodeURIComponent(paths.join(","))}`
          : "/api/scan";
      const res = await fetch(url);
      if (!res.ok) {
        const errBody = (await res.json()) as ScanErrorResponse;
        setScan({ status: "error", message: errBody.error });
        return;
      }
      const data = (await res.json()) as ScanResponse;
      // Flatten all skills from all levels
      const allSkills: SkillFile[] = [
        ...data.projects.flatMap((p) => p.skills),
        ...data.userSkills,
        ...data.pluginSkills,
      ];
      setScan({
        status: "ok",
        skills: allSkills,
        projects: data.projects.map((p) => ({ name: p.name, path: p.path })),
        scannedAt: data.scannedAt,
        durationMs: data.scanDurationMs,
      });
    } catch (err) {
      setScan({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  // Run scan on mount and whenever additionalPaths changes
  React.useEffect(() => {
    void runScan(additionalPaths);
  }, [additionalPaths, runScan]);

  function handlePathsChange(paths: string[]) {
    setAdditionalPaths(paths);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">Skill Lens</h1>
            <span className="text-sm text-muted-foreground">
              Claude Code skill inventory
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </div>
      </header>

      {/* Settings panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onPathsChange={handlePathsChange}
      />

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
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
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Scanned {scan.skills.length} file
                  {scan.skills.length !== 1 ? "s" : ""} in{" "}
                  {scan.durationMs}ms
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {new Date(scan.scannedAt).toLocaleTimeString()}
                </p>
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
                    activeFilter={projectFilter}
                    onFilterChange={setProjectFilter}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-4">
                    <InventoryTable
                      skills={scan.skills}
                      projectFilter={projectFilter}
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
