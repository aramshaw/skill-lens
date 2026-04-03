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
// Column sort helpers
// ---------------------------------------------------------------------------

type SortKey = "name" | "type" | "level" | "projectName" | "description";
type SortDir = "asc" | "desc";

function sortSkills(
  skills: SkillFile[],
  key: SortKey,
  dir: SortDir
): SkillFile[] {
  return [...skills].sort((a, b) => {
    const av = (a[key] ?? "") as string;
    const bv = (b[key] ?? "") as string;
    const cmp = av.localeCompare(bv);
    return dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventoryTable({ skills, projectFilter }: InventoryTableProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [levelFilter, setLevelFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [selected, setSelected] = React.useState<SkillFile | null>(null);

  // Derived unique filter options
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

    return sortSkills(result, sortKey, sortDir);
  }, [skills, projectFilter, search, typeFilter, levelFilter, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(col: SortKey) {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thClass =
    "px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground";
  const tdClass = "px-3 py-2 text-sm";

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
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No skills found
                </td>
              </tr>
            ) : (
              filtered.map((skill) => (
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
                    {skill.projectName ?? <span className="italic">—</span>}
                  </td>
                  <td className={`${tdClass} text-muted-foreground max-w-xs truncate`}>
                    {skill.description || (
                      <span className="italic text-muted-foreground/50">
                        no description
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      <SkillDetailPanel
        skill={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
