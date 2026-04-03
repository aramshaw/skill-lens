"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type {
  ValidatePathResponse,
  ValidatePathErrorResponse,
} from "@/app/api/validate-path/route";
import { useAdditionalPaths } from "@/lib/hooks/use-additional-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "error"; message: string }
  | { status: "ok"; resolvedPath: string };

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { paths, addPath, removePath } = useAdditionalPaths();
  const [input, setInput] = React.useState("");
  const [validation, setValidation] = React.useState<ValidationState>({
    status: "idle",
  });

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;

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

      const resolved = body.resolvedPath;
      addPath(resolved);
      setInput("");
      setValidation({ status: "ok", resolvedPath: resolved });
    } catch (err) {
      setValidation({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
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
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background">
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure additional scan paths.
            </p>
          </div>

          {/* Scan paths section */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold">Scan Paths</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Additional directories to scan for skill files. Paths are
                validated on the server and persisted in your browser.
              </p>
            </div>

            {/* Add path input */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
              <label className="text-sm font-medium">Add a directory path</label>
              <div className="flex gap-2">
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
                  disabled={!input.trim() || validation.status === "validating"}
                >
                  {validation.status === "validating" ? "Checking…" : "Add"}
                </Button>
              </div>

              {validation.status === "error" && (
                <p className="text-xs text-destructive">{validation.message}</p>
              )}
              {validation.status === "ok" && (
                <p className="text-xs text-green-600 dark:text-green-400">
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
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
                  No additional paths configured
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {paths.map((p) => (
                    <li
                      key={p}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-2.5"
                    >
                      <span
                        className="text-sm font-mono text-foreground/80 break-all flex-1"
                        title={p}
                      >
                        {p}
                      </span>
                      <button
                        onClick={() => removePath(p)}
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

            <p className="text-xs text-muted-foreground">
              Paths are saved to your browser and take effect immediately
              &mdash; navigate to the Inventory to see the updated scan results.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
