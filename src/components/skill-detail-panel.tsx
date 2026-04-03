"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { CopyIcon, CheckIcon, LayersIcon } from "lucide-react";
import type { SkillFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OpenInEditorButton } from "@/components/open-in-editor-button";
import { PROSE_CLASSES } from "@/lib/prose-classes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { skillIdentityKey } from "@/lib/analyzer/overlaps";
import { buildOverlapsUrl } from "@/lib/cross-page-nav";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillDetailPanelProps {
  skill: SkillFile | null;
  onClose: () => void;
  /**
   * Set of skill identity keys (e.g. "code-review/SKILL.md") that have overlap
   * clusters. When the open skill's identity is in this set, a "View overlaps"
   * link is shown in the detail panel.
   */
  overlapIdentities?: Set<string>;
}

// ---------------------------------------------------------------------------
// Badge info helper (exported for testing)
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

const CONTEXT_CLASS =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border";

export interface HeaderBadgeInfo {
  typeLabel: SkillFile["type"];
  typeClass: string;
  levelLabel: SkillFile["level"];
  levelClass: string;
  /** Project name, plugin name, or null for user-level skills. */
  contextLabel: string | null;
  contextClass: string;
}

/**
 * Derives the badge labels and CSS classes for the detail panel header.
 * Pure function — no side effects — exported for unit testing.
 */
export function getHeaderBadgeInfo(skill: SkillFile): HeaderBadgeInfo {
  let contextLabel: string | null = null;
  if (skill.level === "project" && skill.projectName) {
    contextLabel = skill.projectName;
  } else if (skill.level === "plugin" && skill.pluginName) {
    contextLabel = skill.pluginName;
  }

  return {
    typeLabel: skill.type,
    typeClass: TYPE_CLASSES[skill.type],
    levelLabel: skill.level,
    levelClass: LEVEL_CLASSES[skill.level],
    contextLabel,
    contextClass: CONTEXT_CLASS,
  };
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
// Main panel
// ---------------------------------------------------------------------------

export function SkillDetailPanel({ skill, onClose, overlapIdentities }: SkillDetailPanelProps) {
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

              {/* Badge row — type, level, and context (project/plugin name) */}
              {(() => {
                const badges = getHeaderBadgeInfo(skill);
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={badges.typeClass}>{badges.typeLabel}</span>
                    <span className={badges.levelClass}>{badges.levelLabel}</span>
                    {badges.contextLabel && (
                      <span className={badges.contextClass}>
                        {badges.contextLabel}
                      </span>
                    )}
                  </div>
                );
              })()}

              {skill.description && (
                <SheetDescription>{skill.description}</SheetDescription>
              )}
            </SheetHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-5">
              {/* File path — wraps rather than truncates so the full path is always readable */}
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
                <span className="flex-1 break-all">
                  {skill.filePath}
                </span>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <CopyButton text={skill.filePath} />
                  <OpenInEditorButton filePath={skill.filePath} />
                </div>
              </div>

              {/* View overlaps link — only shown when this skill has overlap clusters */}
              {(() => {
                const identity = skillIdentityKey(skill.filePath);
                if (!overlapIdentities?.has(identity)) return null;
                return (
                  <Link
                    href={buildOverlapsUrl(identity)}
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="view-overlaps-link"
                  >
                    <LayersIcon className="size-3.5" />
                    View overlaps
                  </Link>
                );
              })()}

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
                    <div className={PROSE_CLASSES}>
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
