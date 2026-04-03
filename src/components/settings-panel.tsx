"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type {
  ValidatePathResponse,
  ValidatePathErrorResponse,
} from "@/app/api/validate-path/route";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "skill-lens:additionalPaths";

export function loadAdditionalPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

function saveAdditionalPaths(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any add/remove — lets the parent re-scan. */
  onPathsChange: (paths: string[]) => void;
}

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "error"; message: string }
  | { status: "ok"; resolvedPath: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPanel({
  open,
  onOpenChange,
  onPathsChange,
}: SettingsPanelProps) {
  const [paths, setPaths] = React.useState<string[]>([]);
  const [input, setInput] = React.useState("");
  const [validation, setValidation] = React.useState<ValidationState>({
    status: "idle",
  });

  // Load from localStorage when the panel first opens
  React.useEffect(() => {
    if (open) {
      setPaths(loadAdditionalPaths());
      setInput("");
      setValidation({ status: "idle" });
    }
  }, [open]);

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Avoid duplicates
    if (paths.includes(trimmed)) {
      setValidation({ status: "error", message: "Path already added" });
      return;
    }

    setValidation({ status: "validating" });

    try {
      const res = await fetch("/api/validate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: trimmed }),
      });

      if (!res.ok) {
        const body = (await res.json()) as ValidatePathErrorResponse;
        setValidation({ status: "error", message: body.error });
        return;
      }

      const body = (await res.json()) as ValidatePathResponse;

      if (!body.valid) {
        setValidation({ status: "error", message: body.reason });
        return;
      }

      // Use the server-resolved canonical path
      const resolved = body.resolvedPath;
      const next = paths.includes(resolved) ? paths : [...paths, resolved];
      setPaths(next);
      saveAdditionalPaths(next);
      onPathsChange(next);
      setInput("");
      setValidation({ status: "ok", resolvedPath: resolved });
    } catch (err) {
      setValidation({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function handleRemove(p: string) {
    const next = paths.filter((x) => x !== p);
    setPaths(next);
    saveAdditionalPaths(next);
    onPathsChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void handleAdd();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    if (validation.status !== "idle") {
      setValidation({ status: "idle" });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Scan Paths</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto">
          {/* Add path section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Add a directory path</label>
            <p className="text-xs text-muted-foreground">
              Additional directories to scan for skill files. Paths are
              validated on the server and persisted in your browser.
            </p>

            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="/home/you/projects/my-repo"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={validation.status === "validating"}
                className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <Button
                size="sm"
                onClick={() => void handleAdd()}
                disabled={
                  !input.trim() || validation.status === "validating"
                }
              >
                {validation.status === "validating" ? "Checking…" : "Add"}
              </Button>
            </div>

            {/* Validation feedback */}
            {validation.status === "error" && (
              <p className="text-xs text-destructive mt-1">
                {validation.message}
              </p>
            )}
            {validation.status === "ok" && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Added: {validation.resolvedPath}
              </p>
            )}
          </div>

          {/* Saved paths list */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              Saved paths{" "}
              <span className="text-muted-foreground font-normal">
                ({paths.length})
              </span>
            </h3>

            {paths.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                No additional paths configured
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {paths.map((p) => (
                  <li
                    key={p}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                  >
                    <span
                      className="text-xs font-mono text-foreground/80 break-all flex-1"
                      title={p}
                    >
                      {p}
                    </span>
                    <button
                      onClick={() => handleRemove(p)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                      aria-label={`Remove ${p}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-auto">
            Changes take effect immediately — the skill list will re-scan
            automatically.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
