"use client";

import * as React from "react";
import type { SkillFile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Pure utility — exported so it can be unit-tested
// ---------------------------------------------------------------------------

export interface ProjectCount {
  /** Project name (from SkillFile.projectName). */
  name: string;
  /** Number of skill/agent/rule files for this project. */
  count: number;
}

export interface ProjectCounts {
  /** One entry per distinct project, sorted alphabetically. */
  projects: ProjectCount[];
  /** Count of user-level files (level === "user"). */
  userCount: number;
  /** Count of plugin-level files (level === "plugin"). */
  pluginCount: number;
  /** Total skill files across all levels. */
  total: number;
}

export function computeProjectCounts(skills: SkillFile[]): ProjectCounts {
  const projectMap = new Map<string, number>();
  let userCount = 0;
  let pluginCount = 0;

  for (const skill of skills) {
    if (skill.level === "user") {
      userCount++;
    } else if (skill.level === "plugin") {
      pluginCount++;
    } else if (skill.projectName !== null) {
      projectMap.set(
        skill.projectName,
        (projectMap.get(skill.projectName) ?? 0) + 1
      );
    }
  }

  const projects: ProjectCount[] = Array.from(projectMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    projects,
    userCount,
    pluginCount,
    total: skills.length,
  };
}

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

/**
 * The current project filter selection.
 * - `null` = "All Projects" (no filter)
 * - `"__user__"` = user-level skills only
 * - `"__plugin__"` = plugin-level skills only
 * - any other string = project name
 */
export type ProjectFilter = string | null;

// ---------------------------------------------------------------------------
// Badge component
// ---------------------------------------------------------------------------

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sidebar item
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function SidebarItem({ label, count, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground",
      ].join(" ")}
    >
      <span className="truncate text-left">{label}</span>
      <CountBadge count={count} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content list — defined at module level to avoid re-creation
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  counts: ProjectCounts;
  activeFilter: ProjectFilter;
  onSelect: (filter: ProjectFilter) => void;
}

function SidebarContent({ counts, activeFilter, onSelect }: SidebarContentProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* All Projects */}
      <SidebarItem
        label="All Projects"
        count={counts.total}
        isActive={activeFilter === null}
        onClick={() => onSelect(null)}
      />

      {/* Divider */}
      {(counts.projects.length > 0 ||
        counts.userCount > 0 ||
        counts.pluginCount > 0) && (
        <div className="my-1.5 h-px bg-border" />
      )}

      {/* Per-project entries */}
      {counts.projects.map((proj) => (
        <SidebarItem
          key={proj.name}
          label={proj.name}
          count={proj.count}
          isActive={activeFilter === proj.name}
          onClick={() => onSelect(proj.name)}
        />
      ))}

      {/* User level */}
      {counts.userCount > 0 && (
        <>
          {counts.projects.length > 0 && (
            <div className="my-1.5 h-px bg-border" />
          )}
          <SidebarItem
            label="User Level"
            count={counts.userCount}
            isActive={activeFilter === "__user__"}
            onClick={() => onSelect("__user__")}
          />
        </>
      )}

      {/* Plugin level */}
      {counts.pluginCount > 0 && (
        <SidebarItem
          label="Plugins"
          count={counts.pluginCount}
          isActive={activeFilter === "__plugin__"}
          onClick={() => onSelect("__plugin__")}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ProjectSidebarProps {
  /** All flattened skill files (projects + user + plugin). */
  skills: SkillFile[];
  /** Current filter value. */
  activeFilter: ProjectFilter;
  /** Called when the user clicks a sidebar entry. */
  onFilterChange: (filter: ProjectFilter) => void;
}

export function ProjectSidebar({
  skills,
  activeFilter,
  onFilterChange,
}: ProjectSidebarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const counts = React.useMemo(() => computeProjectCounts(skills), [skills]);

  function handleSelect(filter: ProjectFilter) {
    onFilterChange(filter);
    setMobileOpen(false);
  }

  const activeLabel =
    activeFilter === null
      ? "All Projects"
      : activeFilter === "__user__"
        ? "User Level"
        : activeFilter === "__plugin__"
          ? "Plugins"
          : activeFilter;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile: dropdown toggle bar                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden mb-2">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          aria-expanded={mobileOpen}
          aria-controls="project-sidebar-mobile"
        >
          <span>
            Filter:{" "}
            <span className="font-semibold">{activeLabel}</span>
          </span>
          <svg
            className={[
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              mobileOpen ? "rotate-180" : "",
            ].join(" ")}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {mobileOpen && (
          <div
            id="project-sidebar-mobile"
            className="mt-1 rounded-md border border-border bg-popover p-2 shadow-md"
          >
            <SidebarContent
              counts={counts}
              activeFilter={activeFilter}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop: always-visible sidebar panel                               */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className="hidden md:flex flex-col gap-1 w-52 shrink-0"
        aria-label="Project filter"
      >
        <p className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Projects
        </p>
        <SidebarContent
          counts={counts}
          activeFilter={activeFilter}
          onSelect={handleSelect}
        />
      </aside>
    </>
  );
}
