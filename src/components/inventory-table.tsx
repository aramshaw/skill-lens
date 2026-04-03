"use client";

import * as React from "react";
import type { SkillFile } from "@/lib/types";
import { SkillDetailPanel } from "./skill-detail-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryTableProps {
  skills: SkillFile[];
  /**
   * Optional project filter from the sidebar.
   * - `null` or `undefined` — show all skills
   * - `"__user__"` — show only user-level skills
   * - `"__plugin__"` — show only plugin-level skills
   * - any other string — show only skills from that project
   */
  projectFilter?: string | null;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const TYPE_CLASSES: Record<SkillFile["type"], string> = {
  skill:
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  agent:
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  rule: "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const LEVEL_CLASSES: Record<SkillFile["level"], string> = {
  user: "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  project:
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  plugin:
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

// ---------------------------------------------------------------------------
// Exported utility: AC1 — PROJECT column display value
// ---------------------------------------------------------------------------

/**
 * Returns the value to display in the PROJECT column for a given skill.
 *
 * - project-level → projectName (or null if not set)
 * - plugin-level  → pluginName  (the plugin directory name)
 * - user-level    → null        (no project context)
 */
export function getProjectColumnValue(skill: SkillFile): string | null {
  if (skill.level === "plugin") {
    return skill.pluginName ?? null;
  }
  if (skill.level === "project") {
    return skill.projectName ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Exported utility: AC2 — Pagination logic
// ---------------------------------------------------------------------------

/** Default page size for the inventory table. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Returns the total number of pages for a given item count and page size.
 * Returns 0 if totalItems is 0.
 */
export function getPageCount(totalItems: number, pageSize: number): number {
  if (totalItems === 0) return 0;
  return Math.ceil(totalItems / pageSize);
}

/**
 * Returns the slice of skills for the given 1-based page number.
 * Pages below 1 are treated as page 1.
 */
export function paginateSkills(
  skills: SkillFile[],
  page: number,
  pageSize: number
): SkillFile[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return skills.slice(start, end);
}

// ---------------------------------------------------------------------------
// Exported utility: AC3 — Default sort (user > project > plugin, then alpha)
// ---------------------------------------------------------------------------

/** Priority order for skill levels: lower number = appears first. */
const LEVEL_PRIORITY: Record<SkillFile["level"], number> = {
  user: 0,
  project: 1,
  plugin: 2,
};

/**
 * Applies the default sort: level priority (user → project → plugin),
 * then alphabetically by name within each level.
 * Does NOT mutate the input array.
 */
export function applyDefaultSort(skills: SkillFile[]): SkillFile[] {
  return [...skills].sort((a, b) => {
    const levelDiff = LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level];
    if (levelDiff !== 0) return levelDiff;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Column sort helpers
// ---------------------------------------------------------------------------

type SortKey = "name" | "type" | "level" | "projectName" | "description";
type SortDir = "asc" | "desc";

/** "default" means use applyDefaultSort (level-priority + alpha). */
type ActiveSort = { key: SortKey; dir: SortDir } | { key: "default" };

function sortSkills(
  skills: SkillFile[],
  sort: ActiveSort
): SkillFile[] {
  if (sort.key === "default") {
    return applyDefaultSort(skills);
  }
  const { key, dir } = sort;
  return [...skills].sort((a, b) => {
    // For projectName column, use getProjectColumnValue so plugin names sort correctly
    const av =
      key === "projectName"
        ? (getProjectColumnValue(a) ?? "")
        : ((a[key] ?? "") as string);
    const bv =
      key === "projectName"
        ? (getProjectColumnValue(b) ?? "")
        : ((b[key] ?? "") as string);
    const cmp = av.localeCompare(bv);
    return dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Pagination button (minimal, no external dependency)
// ---------------------------------------------------------------------------

interface PaginationButtonProps {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  active?: boolean;
  "aria-label"?: string;
}

function PaginationButton({
  onClick,
  disabled,
  children,
  active,
  "aria-label": ariaLabel,
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={[
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted/60",
        disabled ? "pointer-events-none opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventoryTable({ skills, projectFilter }: InventoryTableProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [sort, setSort] = React.useState<ActiveSort>({ key: "default" });
  const [selected, setSelected] = React.useState<SkillFile | null>(null);
  const [page, setPage] = React.useState(1);

  // Reset to page 1 whenever filters / sort change
  React.useEffect(() => {
    setPage(1);
  }, [search, typeFilter, levelFilter, projectFilter, sort]);

  // Filtered + sorted
  const filtered = React.useMemo(() => {
    let result = skills;

    // Project sidebar filter
    if (projectFilter != null) {
      if (projectFilter === "__user__") {
        result = result.filter((s) => s.level === "user");
      } else if (projectFilter === "__plugin__") {
        result = result.filter((s) => s.level === "plugin");
      } else {
        result = result.filter((s) => s.projectName === projectFilter);
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }

    if (levelFilter !== "all") {
      result = result.filter((s) => s.level === levelFilter);
    }

    return sortSkills(result, sort);
  }, [skills, projectFilter, search, typeFilter, levelFilter, sort]);

  // Pagination
  const pageSize = DEFAULT_PAGE_SIZE;
  const pageCount = getPageCount(filtered.length, pageSize);
  const safePage = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const pageItems = paginateSkills(filtered, safePage, pageSize);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: (prev as { key: SortKey; dir: SortDir }).dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  function sortIcon(col: SortKey | "default") {
    if (sort.key !== col) return <span className="ml-1 opacity-30">↕</span>;
    if (sort.key === "default") return null;
    return (
      <span className="ml-1">
        {(sort as { key: SortKey; dir: SortDir }).dir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  const thClass =
    "px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground";
  const tdClass = "px-3 py-2 text-sm";

  // Generate page number buttons (at most 7 visible: first, last, current±1, ellipsis)
  function pageNumbers(): (number | "…")[] {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const pages: (number | "…")[] = [1];
    if (safePage > 3) pages.push("…");
    for (let p = Math.max(2, safePage - 1); p <= Math.min(pageCount - 1, safePage + 1); p++) {
      pages.push(p);
    }
    if (safePage < pageCount - 2) pages.push("…");
    pages.push(pageCount);
    return pages;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-48"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All types</option>
          <option value="skill">Skill</option>
          <option value="agent">Agent</option>
          <option value="rule">Rule</option>
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All levels</option>
          <option value="user">User</option>
          <option value="project">Project</option>
          <option value="plugin">Plugin</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} / {skills.length} items
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
            <tr>
              <th className={thClass} onClick={() => handleSort("name")}>
                Name {sortIcon("name")}
              </th>
              <th className={thClass} onClick={() => handleSort("type")}>
                Type {sortIcon("type")}
              </th>
              <th className={thClass} onClick={() => handleSort("level")}>
                Level {sortIcon("level")}
              </th>
              <th
                className={thClass}
                onClick={() => handleSort("projectName")}
              >
                Project {sortIcon("projectName")}
              </th>
              <th
                className={thClass}
                onClick={() => handleSort("description")}
              >
                Description {sortIcon("description")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No skills found
                </td>
              </tr>
            ) : (
              pageItems.map((skill) => {
                const projectValue = getProjectColumnValue(skill);
                return (
                  <tr
                    key={skill.filePath}
                    onClick={() => setSelected(skill)}
                    className="cursor-pointer transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelected(skill);
                      }
                    }}
                  >
                    <td className={`${tdClass} font-medium`}>{skill.name}</td>
                    <td className={tdClass}>
                      <span className={TYPE_CLASSES[skill.type]}>
                        {skill.type}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className={LEVEL_CLASSES[skill.level]}>
                        {skill.level}
                      </span>
                    </td>
                    <td className={`${tdClass} text-muted-foreground`}>
                      {projectValue ?? <span className="italic">—</span>}
                    </td>
                    <td className={`${tdClass} text-muted-foreground max-w-xs truncate`}>
                      {skill.description || (
                        <span className="italic text-muted-foreground/50">
                          no description
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Page {safePage} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              ‹
            </PaginationButton>
            {pageNumbers().map((pn, idx) =>
              pn === "…" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-sm text-muted-foreground select-none"
                >
                  …
                </span>
              ) : (
                <PaginationButton
                  key={pn}
                  onClick={() => setPage(pn)}
                  disabled={false}
                  active={pn === safePage}
                  aria-label={`Page ${pn}`}
                >
                  {pn}
                </PaginationButton>
              )
            )}
            <PaginationButton
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage === pageCount}
              aria-label="Next page"
            >
              ›
            </PaginationButton>
          </div>
        </div>
      )}

      {/* Detail panel */}
      <SkillDetailPanel
        skill={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
