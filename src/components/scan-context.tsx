"use client";

/**
 * ScanContext — shared scan state for the NavBar re-scan button and status.
 *
 * Pages that run their own scans should call `registerScan` to expose
 * their scannedAt timestamp and trigger function to the NavBar.
 */

import * as React from "react";

interface ScanContextValue {
  scannedAt: string | null;
  scanning: boolean;
  rescan: (() => void) | null;
  /** Pages call this to register their scan controls with the layout. */
  registerScan: (opts: {
    scannedAt: string | null;
    scanning: boolean;
    rescan: () => void;
  }) => void;
}

const ScanContext = React.createContext<ScanContextValue>({
  scannedAt: null,
  scanning: false,
  rescan: null,
  registerScan: () => undefined,
});

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [scannedAt, setScannedAt] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const rescanRef = React.useRef<(() => void) | null>(null);

  const registerScan = React.useCallback(
    (opts: { scannedAt: string | null; scanning: boolean; rescan: () => void }) => {
      setScannedAt(opts.scannedAt);
      setScanning(opts.scanning);
      rescanRef.current = opts.rescan;
    },
    []
  );

  const rescan = React.useCallback(() => {
    rescanRef.current?.();
  }, []);

  const value = React.useMemo(
    () => ({ scannedAt, scanning, rescan, registerScan }),
    [scannedAt, scanning, rescan, registerScan]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanContext() {
  return React.useContext(ScanContext);
}
