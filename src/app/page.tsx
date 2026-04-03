"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InventoryTable } from "@/components/inventory-table";
import { ProjectSidebar } from "@/components/project-sidebar";
import { ClaudeMdViewer } from "@/components/claude-md-viewer";
import { useAdditionalPaths } from "@/lib/hooks/use-additional-paths";
import { useScanState } from "@/lib/hooks/use-scan-state";
import { parseSearchParam } from "@/lib/cross-page-nav";
import { filterSkillsByProject } from "@/lib/filter-skills";
import type { ProjectFilter } from "@/components/project-sidebar";
import type { DashboardStats, ProjectRef } from "@/lib/hooks/use-scan-state";
import type { SkillFile } from "@/lib/types";

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
// Loading / error / empty states
// ---------------------------------------------------------------------------

function ScanLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <p className="text-sm">Scanning projects…</p>
    </div>
  );
}

function ScanError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
      <strong>Scan failed:</strong> {message}
    </div>
  );
}

function EmptySkillsNotice() {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
      No skill files found. Add some skills to{" "}
      <code className="font-mono text-xs">~/.claude/skills/</code>{" "}
      or a project&apos;s{" "}
      <code className="font-mono text-xs">.claude/skills/</code>{" "}
      directory.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard stats row
// ---------------------------------------------------------------------------

interface DashboardStatsRowProps {
  stats: DashboardStats;
  skills: SkillFile[];
  projectFilter: ProjectFilter;
}

function DashboardStatsRow({ stats, skills, projectFilter }: DashboardStatsRowProps) {
  const filteredSkills = filterSkillsByProject(skills, projectFilter);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label={projectFilter !== null ? "Filtered skills" : "Total skills"}
        value={filteredSkills.length}
        href="/"
        colorClass="text-foreground"
      />
      <StatCard label="Overlaps" value={stats.overlaps} href="/overlaps" colorClass="text-amber-600 dark:text-amber-400" />
      <StatCard label="Gaps" value={stats.gaps} href="/insights" colorClass="text-orange-600 dark:text-orange-400" />
      <StatCard label="Contradictions" value={stats.contradictions} href="/insights" colorClass="text-blue-600 dark:text-blue-400" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory layout (sidebar + table + CLAUDE.md viewer)
// ---------------------------------------------------------------------------

interface InventoryLayoutProps {
  skills: SkillFile[];
  projects: ProjectRef[];
  projectFilter: ProjectFilter;
  onFilterChange: (f: ProjectFilter) => void;
  initialSearch: string;
  stats: DashboardStats | null;
}

function InventoryLayout({ skills, projects, projectFilter, onFilterChange, initialSearch, stats }: InventoryLayoutProps) {
  const selectedProject = projectFilter !== null && projectFilter !== "__user__" && projectFilter !== "__plugin__"
    ? projects.find((p) => p.name === projectFilter)
    : undefined;

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <ProjectSidebar skills={skills} projects={projects} activeFilter={projectFilter} onFilterChange={onFilterChange} />
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <InventoryTable
          skills={skills}
          projectFilter={projectFilter}
          initialSearch={initialSearch}
          overlapIdentities={stats?.overlapIdentities}
        />
        {selectedProject && (
          <ClaudeMdViewer projectPath={selectedProject.path} projectName={selectedProject.name} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const searchParams = useSearchParams();
  const initialSearch = parseSearchParam(searchParams.get("search"));
  const [projectFilter, setProjectFilter] = React.useState<ProjectFilter>(null);
  const { paths: additionalPaths } = useAdditionalPaths();
  const scan = useScanState(additionalPaths);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background">
      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {scan.status === "loading" && <ScanLoading />}
          {scan.status === "error" && <ScanError message={scan.message} />}
          {scan.status === "ok" && (
            <>
              {scan.stats && (
                <DashboardStatsRow stats={scan.stats} skills={scan.skills} projectFilter={projectFilter} />
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {scan.skills.length} file{scan.skills.length !== 1 ? "s" : ""} scanned in {scan.durationMs}ms
                </p>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Manage scan paths
                </Link>
              </div>
              {scan.skills.length === 0 ? (
                <EmptySkillsNotice />
              ) : (
                <InventoryLayout
                  skills={scan.skills}
                  projects={scan.projects}
                  projectFilter={projectFilter}
                  onFilterChange={setProjectFilter}
                  initialSearch={initialSearch}
                  stats={scan.stats}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
