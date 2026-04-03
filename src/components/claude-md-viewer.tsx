"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { FileTextIcon } from "lucide-react";
import type { ClaudeMdResponse } from "@/app/api/claude-md/route";
import { OpenInEditorButton } from "@/components/open-in-editor-button";
import { PROSE_CLASSES } from "@/lib/prose-classes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeMdViewerProps {
  /** Absolute path to the project root. Pass null to hide the viewer. */
  projectPath: string | null;
  /** Human-readable project name, used in headings. */
  projectName: string | null;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: ClaudeMdResponse };

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabKey = "project" | "user";

// ---------------------------------------------------------------------------
// Markdown panel
// ---------------------------------------------------------------------------

function MarkdownPanel({
  content,
  filePath,
}: {
  content: string;
  filePath: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* File path + open button */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
        <span
          className="flex-1 truncate font-mono text-xs text-muted-foreground"
          title={filePath}
        >
          {filePath}
        </span>
        <OpenInEditorButton filePath={filePath} title={`Open ${filePath} in default editor`} />
      </div>

      {/* Rendered markdown */}
      <div className={PROSE_CLASSES}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

interface TabBarProps {
  activeTab: TabKey;
  hasProject: boolean;
  hasUser: boolean;
  onTabChange: (tab: TabKey) => void;
}

function TabBar({ activeTab, hasProject, hasUser, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-1 border-b border-border pb-0">
      {hasProject && (
        <button
          type="button"
          onClick={() => onTabChange("project")}
          className={[
            "px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "project"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Project
        </button>
      )}
      {hasUser && (
        <button
          type="button"
          onClick={() => onTabChange("user")}
          className={[
            "px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            activeTab === "user"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          User Level
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClaudeMdViewer({ projectPath, projectName }: ClaudeMdViewerProps) {
  const [loadState, setLoadState] = React.useState<LoadState>({ status: "idle" });
  const [activeTab, setActiveTab] = React.useState<TabKey>("project");

  // Fetch when projectPath changes
  React.useEffect(() => {
    if (!projectPath) {
      setLoadState({ status: "idle" });
      return;
    }

    setLoadState({ status: "loading" });

    const encoded = encodeURIComponent(projectPath);

    fetch(`/api/claude-md?projectPath=${encoded}`)
      .then(async (res) => {
        if (res.status === 404) {
          setLoadState({
            status: "error",
            message: "No CLAUDE.md found for this project.",
          });
          return;
        }
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setLoadState({
            status: "error",
            message: body.error ?? "Failed to load CLAUDE.md",
          });
          return;
        }
        const data = (await res.json()) as ClaudeMdResponse;
        setLoadState({ status: "ok", data });
        // Default to project tab if it has content, otherwise user
        setActiveTab(data.projectContent !== null ? "project" : "user");
      })
      .catch((err: unknown) => {
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      });
  }, [projectPath]);

  if (!projectPath) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileTextIcon className="size-4 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-semibold">
          CLAUDE.md
          {projectName && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              — {projectName}
            </span>
          )}
        </h2>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {loadState.status === "loading" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Loading CLAUDE.md…</span>
          </div>
        )}

        {loadState.status === "error" && (
          <p className="py-4 text-sm text-muted-foreground italic">
            {loadState.message}
          </p>
        )}

        {loadState.status === "ok" && (() => {
          const { projectContent, userContent, projectClaudeMdPath, userClaudeMdPath } = loadState.data;
          const bothExist = projectContent !== null && userContent !== null;

          // Determine which content to show in the panel
          let panelContent: string;
          let panelPath: string;
          if (bothExist) {
            panelContent = activeTab === "project"
              ? projectContent
              : (userContent ?? "");
            panelPath = activeTab === "project"
              ? projectClaudeMdPath
              : userClaudeMdPath;
          } else if (projectContent !== null) {
            panelContent = projectContent;
            panelPath = projectClaudeMdPath;
          } else {
            panelContent = userContent ?? "";
            panelPath = userClaudeMdPath;
          }

          return (
            <div className="flex flex-col gap-4">
              {/* Tabs — only shown when both levels exist */}
              {bothExist && (
                <TabBar
                  activeTab={activeTab}
                  hasProject
                  hasUser
                  onTabChange={setActiveTab}
                />
              )}
              <MarkdownPanel content={panelContent} filePath={panelPath} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
