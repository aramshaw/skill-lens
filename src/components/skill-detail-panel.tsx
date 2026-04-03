"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { CopyIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import type { SkillFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillDetailPanelProps {
  skill: SkillFile | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Frontmatter display — renders key-value pairs
// ---------------------------------------------------------------------------

function FrontmatterTable({
  frontmatter,
}: {
  frontmatter: Record<string, unknown>;
}) {
  const entries = Object.entries(frontmatter);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No frontmatter fields
      </p>
    );
  }

  function formatValue(val: unknown): React.ReactNode {
    if (val === null || val === undefined) return <em>null</em>;
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return val || <em className="text-muted-foreground/50">empty</em>;
    if (Array.isArray(val)) {
      return (
        <span className="font-mono text-xs">
          [{val.map(String).join(", ")}]
        </span>
      );
    }
    return (
      <span className="font-mono text-xs break-all">
        {JSON.stringify(val)}
      </span>
    );
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {entries.map(([key, val]) => (
        <React.Fragment key={key}>
          <dt className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {key}
          </dt>
          <dd className="text-sm text-foreground break-words">
            {formatValue(val)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Copy button with transient checkmark
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently fail
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      title="Copy path"
      aria-label="Copy file path to clipboard"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-green-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Open in Editor button
// ---------------------------------------------------------------------------

function OpenInEditorButton({ filePath }: { filePath: string }) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle"
  );

  async function handleOpen() {
    setStatus("loading");
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      if (!res.ok) {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpen}
      disabled={status === "loading"}
      title="Open in default editor"
    >
      <ExternalLinkIcon className="size-3.5" />
      {status === "error" ? "Failed to open" : "Open in Editor"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function SkillDetailPanel({ skill, onClose }: SkillDetailPanelProps) {
  const isOpen = skill !== null;

  // Handle Escape key — base-ui Dialog already handles Escape natively,
  // but we also listen at document level as a fallback for non-modal sheets.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col overflow-hidden p-0"
      >
        {skill && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
              <SheetTitle className="text-base font-semibold">
                {skill.name}
              </SheetTitle>
              {skill.description && (
                <SheetDescription>{skill.description}</SheetDescription>
              )}
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-5">
              {/* File path */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
                <span className="flex-1 truncate" title={skill.filePath}>
                  {skill.filePath}
                </span>
                <CopyButton text={skill.filePath} />
                <OpenInEditorButton filePath={skill.filePath} />
              </div>

              {/* Frontmatter */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Frontmatter
                </h3>
                <FrontmatterTable frontmatter={skill.frontmatter} />
              </section>

              {skill.body.trim() && (
                <>
                  <Separator />
                  {/* Markdown body */}
                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Content
                    </h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:text-xs">
                      <ReactMarkdown>{skill.body}</ReactMarkdown>
                    </div>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
