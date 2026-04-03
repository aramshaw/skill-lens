"use client";

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Shared "Open in Editor" button
// ---------------------------------------------------------------------------

interface OpenInEditorButtonProps {
  filePath: string;
  /** Optional title attribute on the button element. Defaults to "Open in default editor". */
  title?: string;
}

/**
 * Button that calls POST /api/open to open a file in the OS default editor.
 * Shows a transient "Failed to open" label on error, resetting after 3 s.
 */
export function OpenInEditorButton({
  filePath,
  title = "Open in default editor",
}: OpenInEditorButtonProps) {
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
      title={title}
    >
      <ExternalLinkIcon className="size-3.5" />
      {status === "error" ? "Failed to open" : "Open in Editor"}
    </Button>
  );
}
