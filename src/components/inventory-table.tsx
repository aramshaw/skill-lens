"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import type { SkillFile } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryTableProps {
  data: SkillFile[];
  loading: boolean;
  scannedAt?: string;
  scanDurationMs?: number;
}

// ---------------------------------------------------------------------------
// Column helper
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<SkillFile>();

const columns = [
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => (
      <span className="font-medium text-foreground">{info.getValue()}</span>
    ),
    enableSorting: true,
  }),
  columnHelper.accessor("type", {
    header: "Type",
    cell: (info) => {
      const v = info.getValue();
      const variant =
        v === "skill"
          ? "default"
          : v === "agent"
            ? "secondary"
            : ("outline" as const);
      return <Badge variant={variant}>{v}</Badge>;
    },
    enableSorting: true,
    filterFn: "equals",
  }),
  columnHelper.accessor("level", {
    header: "Level",
    cell: (info) => {
      const v = info.getValue();
      const variant =
        v === "user"
          ? "outline"
          : v === "project"
            ? "secondary"
            : ("default" as const);
      return <Badge variant={variant}>{v}</Badge>;
    },
    enableSorting: true,
    filterFn: "equals",
  }),
  columnHelper.accessor(
    (row) => row.projectName ?? (row.level === "plugin" ? "(plugin)" : "(user)"),
    {
      id: "project",
      header: "Project",
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
      enableSorting: true,
      filterFn: "equals",
    }
  ),
  columnHelper.accessor("description", {
    header: "Description",
    cell: (info) => (
      <span className="text-muted-foreground line-clamp-2 max-w-xs">
        {info.getValue() || <em className="opacity-50">—</em>}
      </span>
    ),
    enableSorting: true,
  }),
  columnHelper.accessor(
    (row) => (row.frontmatter.model as string | undefined) ?? "",
    {
      id: "model",
      header: "Model",
      cell: (info) =>
        info.getValue() ? (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ) : (
          <span className="text-muted-foreground opacity-50">—</span>
        ),
      enableSorting: true,
    }
  ),
  columnHelper.accessor(
    (row) => (row.frontmatter.effort as string | undefined) ?? "",
    {
      id: "effort",
      header: "Effort",
      cell: (info) =>
        info.getValue() ? (
          <Badge variant="outline">{info.getValue()}</Badge>
        ) : (
          <span className="text-muted-foreground opacity-50">—</span>
        ),
      enableSorting: true,
    }
  ),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function SortIcon({
  sorted,
}: {
  sorted: false | "asc" | "desc";
}) {
  if (sorted === "asc") return <ArrowUp className="size-3.5 ml-1 inline-block" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5 ml-1 inline-block" />;
  return <ArrowUpDown className="size-3.5 ml-1 inline-block opacity-40" />;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter select helper
// ---------------------------------------------------------------------------

function FilterSelect({
  placeholder,
  value,
  onValueChange,
  options,
}: {
  placeholder: string;
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(v: string | null) => onValueChange(v ?? "all")}
    >
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InventoryTable({
  data,
  loading,
  scannedAt,
  scanDurationMs,
}: InventoryTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Derived filter values
  const typeFilter =
    (columnFilters.find((f) => f.id === "type")?.value as string) ?? "";
  const levelFilter =
    (columnFilters.find((f) => f.id === "level")?.value as string) ?? "";
  const projectFilter =
    (columnFilters.find((f) => f.id === "project")?.value as string) ?? "";

  // Unique option lists
  const projectOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          data.map(
            (s) =>
              s.projectName ?? (s.level === "plugin" ? "(plugin)" : "(user)")
          )
        )
      ).sort(),
    [data]
  );

  function setColumnFilter(id: string, value: string) {
    setColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== id);
      if (!value || value === "all") return without;
      return [...without, { id, value }];
    });
  }

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const lower = filterValue.toLowerCase();
      return (
        row.original.name.toLowerCase().includes(lower) ||
        row.original.description.toLowerCase().includes(lower)
      );
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or description…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-64"
        />

        <FilterSelect
          placeholder="All types"
          value={typeFilter}
          onValueChange={(v) => setColumnFilter("type", v)}
          options={["skill", "agent", "rule"]}
        />

        <FilterSelect
          placeholder="All levels"
          value={levelFilter}
          onValueChange={(v) => setColumnFilter("level", v)}
          options={["user", "project", "plugin"]}
        />

        <FilterSelect
          placeholder="All projects"
          value={projectFilter}
          onValueChange={(v) => setColumnFilter("project", v)}
          options={projectOptions}
        />

        <span className="ml-auto text-sm text-muted-foreground">
          {loading
            ? "Scanning…"
            : `${table.getFilteredRowModel().rows.length} of ${data.length} items`}
        </span>
      </div>

      {/* Scan metadata */}
      {!loading && scannedAt && (
        <p className="text-xs text-muted-foreground">
          Scanned {formatTimestamp(scannedAt)}
          {scanDurationMs !== undefined && ` in ${scanDurationMs}ms`}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="text-lg font-medium">No skills found</p>
          <p className="text-sm mt-1">
            Make sure you have skills, agents, or rules in your projects.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <SortIcon sorted={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-10"
                >
                  No results match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
