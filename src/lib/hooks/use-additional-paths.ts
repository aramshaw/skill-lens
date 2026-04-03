"use client";

import * as React from "react";
import { loadAdditionalPaths, saveAdditionalPaths } from "@/lib/storage";

// ---------------------------------------------------------------------------
// useAdditionalPaths
//
// Shared hook that manages the list of additional scan paths stored in
// localStorage. All components that need to read or modify additional paths
// should use this hook instead of calling storage helpers directly.
//
// Features:
// - Loads paths from localStorage on mount
// - Persists changes immediately via saveAdditionalPaths
// - Listens for storage events so changes made in other tabs are reflected
// - Listens for visibilitychange so returning from the /settings page in the
//   same tab picks up any new paths without requiring a full page reload
// ---------------------------------------------------------------------------

export function useAdditionalPaths() {
  const [paths, setPaths] = React.useState<string[]>([]);

  // Load on mount
  React.useEffect(() => {
    setPaths(loadAdditionalPaths());
  }, []);

  // Re-sync when returning from another tab/page
  React.useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        setPaths(loadAdditionalPaths());
      }
    }

    function handleStorageEvent(e: StorageEvent) {
      if (e.key === "skill-lens:additionalPaths") {
        setPaths(loadAdditionalPaths());
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const addPath = React.useCallback((resolvedPath: string) => {
    setPaths((prev) => {
      if (prev.includes(resolvedPath)) return prev;
      const next = [...prev, resolvedPath];
      saveAdditionalPaths(next);
      return next;
    });
  }, []);

  const removePath = React.useCallback((path: string) => {
    setPaths((prev) => {
      const next = prev.filter((p) => p !== path);
      saveAdditionalPaths(next);
      return next;
    });
  }, []);

  return { paths, addPath, removePath };
}
