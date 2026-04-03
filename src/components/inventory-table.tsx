'use client';

/**
 * InventoryTable — displays all discovered skill/agent/rule files.
 *
 * Features:
 * - Columns: Name, Type, Level, Project, Description
 * - Global search (filters name + description)
 * - Sortable columns (click header to toggle)
 * - "Open" button per row — calls POST /api/open and shows toast feedback
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'type' | 'level' | 'projectName' | 'description';
type SortDir = 'asc' | 'desc';

interface InventoryTableProps {
  /** All skill files to display (flat list across all projects and levels). */
  skills: SkillFile[];
  /** Whether the data is still loading. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open a file via the API and show a toast. */
async function openFile(filePath: string): Promise<void> {
  try {
    const response = await fetch('/api/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });

    if (response.ok) {
      toast.success('File opened in default editor');
    } else {
      const data = (await response.json()) as { error?: string };
      toast.error(data.error ?? 'Failed to open file');
    }
  } catch {
    toast.error('Network error — could not open file');
  }
}

/** Case-insensitive string comparison for sorting. */
function compareStrings(a: string | null, b: string | null): number {
  const sa = (a ?? '').toLowerCase();
  const sb = (b ?? '').toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/** Sort a list of SkillFiles by the given key and direction. */
function sortSkills(skills: SkillFile[], key: SortKey, dir: SortDir): SkillFile[] {
  const sorted = [...skills].sort((a, b) => {
    let cmp: number;
    switch (key) {
      case 'name':
        cmp = compareStrings(a.name, b.name);
        break;
      case 'type':
        cmp = compareStrings(a.type, b.type);
        break;
      case 'level':
        cmp = compareStrings(a.level, b.level);
        break;
      case 'projectName':
        cmp = compareStrings(a.projectName, b.projectName);
        break;
      case 'description':
        cmp = compareStrings(a.description, b.description);
        break;
      default:
        cmp = 0;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

/** Filter skills by a global search query (name + description). */
function filterSkills(skills: SkillFile[], query: string): SkillFile[] {
  if (!query.trim()) return skills;
  const q = query.trim().toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}

// ---------------------------------------------------------------------------
// Column header with sort indicator
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey;
  const indicator = isActive ? (currentDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-0.5 opacity-70">{indicator}</span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Badge for type / level
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<SkillFile['type'], string> = {
  skill: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  agent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  rule: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

const LEVEL_COLORS: Record<SkillFile['level'], string> = {
  user: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  project: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  plugin: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

function Badge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InventoryTable({ skills, loading = false }: InventoryTableProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');
  const [openingPath, setOpeningPath] = React.useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleOpen = async (filePath: string) => {
    setOpeningPath(filePath);
    await openFile(filePath);
    setOpeningPath(null);
  };

  const filtered = filterSkills(skills, searchQuery);
  const sorted = sortSkills(filtered, sortKey, sortDir);

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder="Search by name or description…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {sorted.length} / {skills.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <SortableHeader
                label="Name"
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Type"
                sortKey="type"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Level"
                sortKey="level"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Project"
                sortKey="projectName"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Description"
                sortKey="description"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {skills.length === 0
                    ? 'No skills found. Make sure your projects are scanned.'
                    : 'No results match your search.'}
                </td>
              </tr>
            ) : (
              sorted.map((skill) => (
                <tr
                  key={skill.filePath}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                    {skill.name}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      label={skill.type}
                      colorClass={TYPE_COLORS[skill.type]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      label={skill.level}
                      colorClass={LEVEL_COLORS[skill.level]}
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                    {skill.projectName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[300px] truncate">
                    {skill.description || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpen(skill.filePath)}
                      disabled={openingPath === skill.filePath}
                      aria-label={`Open ${skill.name} in editor`}
                    >
                      {openingPath === skill.filePath ? 'Opening…' : 'Open'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
