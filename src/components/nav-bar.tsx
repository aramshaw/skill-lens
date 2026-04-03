"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScanContext } from "@/components/scan-context";

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Inventory" },
  { href: "/overlaps", label: "Overlaps" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();
  const { scannedAt, scanning, rescan } = useScanContext();

  // Determine active link — exact match for "/" to avoid matching everything
  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        {/* Branding */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:text-foreground/80 transition-colors shrink-0"
        >
          <span className="text-base">Skill Lens</span>
        </Link>

        {/* Divider */}
        <span className="h-5 w-px bg-border shrink-0" aria-hidden="true" />

        {/* Navigation links */}
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                isActive(href)
                  ? "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium bg-foreground/8 text-foreground transition-colors"
                  : "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              }
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Scan status + re-scan button */}
        <div className="flex items-center gap-3 shrink-0">
          {scannedAt && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Last scan{" "}
              <time dateTime={scannedAt}>
                {new Date(scannedAt).toLocaleTimeString()}
              </time>
            </span>
          )}
          {rescan && (
            <button
              onClick={rescan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Re-scan projects"
            >
              {scanning ? (
                <>
                  <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />
                  Scanning…
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-3"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.01.75.75 0 1 1-1.3-.75 6 6 0 0 1 9.44-1.347l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.347l-.842-.841v1.274a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.84.841a4.5 4.5 0 0 0 7.08-1.01.75.75 0 0 1 1.025-.195Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Re-scan
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
