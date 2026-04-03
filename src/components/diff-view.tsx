"use client";

/**
 * DiffView — side-by-side diff view for overlapping SkillFiles.
 *
 * Exports:
 *   - serializeSkillFile(skill): string        — converts a SkillFile to diffable text
 *   - computeFileDiff(a, b): FileDiffResult    — computes line-level diff
 *   - DiffView                                 — React component
 */

import * as React from "react";
import { diffLines } from "diff";
import { locationLabel } from "@/lib/overlaps-utils";
import type { SkillFile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffLineType = "equal" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface FileDiffResult {
  isIdentical: boolean;
  lines: DiffLine[];
}

interface DiffViewProps {
  /** The cluster of files to compare. Must have at least 2 entries. */
  files: SkillFile[];
  /** Optional callback when the view is closed. */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Utility: serialize a SkillFile to a diffable text string
// ---------------------------------------------------------------------------

/**
 * Converts a SkillFile to a canonical text representation for diffing.
 * Format: YAML frontmatter block (--- ... ---) followed by the markdown body.
 */
export function serializeSkillFile(skill: SkillFile): string {
  const entries = Object.entries(skill.frontmatter);

  let yamlLines = "---\n";
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      yamlLines += `${key}:\n`;
      for (const item of value) {
        yamlLines += `  - ${String(item)}\n`;
      }
    } else if (value === null || value === undefined) {
      yamlLines += `${key}: null\n`;
    } else if (typeof value === "object") {
      yamlLines += `${key}: ${JSON.stringify(value)}\n`;
    } else {
      yamlLines += `${key}: ${String(value)}\n`;
    }
  }
  yamlLines += "---\n";

  const body = skill.body.trim() ? "\n" + skill.body : "";
  return yamlLines + body;
}

// ---------------------------------------------------------------------------
// Utility: compute line-level diff between two SkillFiles
// ---------------------------------------------------------------------------

/**
 * Computes a line-level diff between two SkillFiles.
 * Returns isIdentical=true and all "equal" lines if content is identical.
 */
export function computeFileDiff(a: SkillFile, b: SkillFile): FileDiffResult {
  const textA = serializeSkillFile(a);
  const textB = serializeSkillFile(b);

  if (textA === textB) {
    const lines: DiffLine[] = textA.split("\n").map((text) => ({
      type: "equal" as DiffLineType,
      text,
    }));
    return { isIdentical: true, lines };
  }

  const changes = diffLines(textA, textB);
  const lines: DiffLine[] = [];

  for (const change of changes) {
    const type: DiffLineType = change.added
      ? "added"
      : change.removed
        ? "removed"
        : "equal";
    // Split the chunk into individual lines; filter trailing empty from trailing \n
    const rawLines = change.value.split("\n");
    // If the last element is empty string (from trailing newline), remove it
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
      rawLines.pop();
    }
    for (const text of rawLines) {
      lines.push({ type, text });
    }
  }

  return { isIdentical: false, lines };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Renders a single side of the diff (left or right panel). */
function DiffPanel({
  skill,
  lines,
  side,
}: {
  skill: SkillFile;
  lines: DiffLine[];
  side: "left" | "right";
}) {
  const lineTypes = side === "left" ? ["equal", "removed"] : ["equal", "added"];

  const visibleLines = lines.filter((l) => lineTypes.includes(l.type));

  function lineClass(type: DiffLineType): string {
    if (type === "added")
      return "bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-100";
    if (type === "removed")
      return "bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100";
    return "text-foreground";
  }

  const displayProject = locationLabel(skill);

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden border border-border rounded-lg">
      {/* Panel header */}
      <div className="px-3 py-2 bg-muted/40 border-b border-border shrink-0">
        <p
          className="text-xs font-semibold truncate text-foreground"
          title={skill.filePath}
        >
          {displayProject}
        </p>
        <p
          className="text-xs text-muted-foreground truncate font-mono"
          title={skill.filePath}
        >
          {skill.filePath}
        </p>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-y-auto overflow-x-auto font-mono text-xs leading-relaxed">
        <table className="min-w-full border-collapse">
          <tbody>
            {visibleLines.map((line, i) => (
              <tr key={i} className={lineClass(line.type)}>
                <td
                  className="select-none px-2 text-right text-muted-foreground/50 border-r border-border/30 w-10 shrink-0"
                  aria-hidden
                >
                  {i + 1}
                </td>
                <td className="px-3 py-px whitespace-pre">
                  {line.type === "added" && (
                    <span className="mr-1 text-green-600 dark:text-green-400 font-bold">
                      +
                    </span>
                  )}
                  {line.type === "removed" && (
                    <span className="mr-1 text-red-600 dark:text-red-400 font-bold">
                      -
                    </span>
                  )}
                  {line.type === "equal" && (
                    <span className="mr-1 text-transparent select-none">
                      {" "}
                    </span>
                  )}
                  {line.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File selector — shown when cluster has 3+ files
// ---------------------------------------------------------------------------

function FileSelector({
  files,
  selectedIndex,
  onSelect,
  label,
}: {
  files: SkillFile[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {label}:
      </label>
      <select
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring min-w-0 flex-1"
        aria-label={label}
      >
        {files.map((file, i) => (
          <option key={file.filePath} value={i}>
            {file.name} ({locationLabel(file)})
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffView — main component
// ---------------------------------------------------------------------------

export function DiffView({ files, onClose }: DiffViewProps) {
  const [leftIndex, setLeftIndex] = React.useState(0);
  const [rightIndex, setRightIndex] = React.useState(1);

  // Guard: need at least 2 files
  if (files.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Not enough files to compare (need at least 2).
      </div>
    );
  }

  // Clamp indices in case files array shrinks
  const safeLeft = Math.min(leftIndex, files.length - 1);
  const safeRight = Math.min(rightIndex, files.length - 1);

  const fileA = files[safeLeft];
  const fileB = files[safeRight];

  const diffResult = computeFileDiff(fileA, fileB);

  const showSelector = files.length >= 3;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {showSelector && (
          <>
            <FileSelector
              files={files}
              selectedIndex={safeLeft}
              onSelect={(i) => {
                setLeftIndex(i);
                if (i === safeRight) {
                  setRightIndex(i === files.length - 1 ? 0 : i + 1);
                }
              }}
              label="Version A (left)"
            />
            <FileSelector
              files={files}
              selectedIndex={safeRight}
              onSelect={(i) => {
                setRightIndex(i);
                if (i === safeLeft) {
                  setLeftIndex(i === files.length - 1 ? 0 : i + 1);
                }
              }}
              label="Version B (right)"
            />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {diffResult.isIdentical && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Files are identical
            </span>
          )}
          {!diffResult.isIdentical && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                +{diffResult.lines.filter((l) => l.type === "added").length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                -{diffResult.lines.filter((l) => l.type === "removed").length}
              </span>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Close diff view"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Identical message or diff panels */}
      {diffResult.isIdentical ? (
        <div className="flex items-center justify-center flex-1 rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground py-12">
          <div className="text-center">
            <p className="font-medium text-base mb-1">Files are identical</p>
            <p className="text-xs">Both versions have the same content.</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          <DiffPanel
            skill={fileA}
            lines={diffResult.lines}
            side="left"
          />
          <DiffPanel
            skill={fileB}
            lines={diffResult.lines}
            side="right"
          />
        </div>
      )}
    </div>
  );
}
