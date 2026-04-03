/**
 * Project discovery — reads ~/.claude.json and extracts known project paths.
 *
 * This module is server-side only (Node.js). It is intentionally read-only:
 * it never writes to any file.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Project } from '@/lib/types';

/** Normalize a path to forward-slash POSIX style for internal use. */
function normalizePath(p: string): string {
  // Replace all backslashes with forward slashes
  return p.replace(/\\/g, '/');
}

/**
 * Read and parse ~/.claude.json, returning the raw projects object.
 * Returns null if the file doesn't exist or is malformed.
 */
function readClaudeJson(
  claudeJsonPath: string
): Record<string, unknown> | null {
  if (!fs.existsSync(claudeJsonPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(claudeJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Discover projects from ~/.claude.json.
 *
 * - Reads and parses ~/.claude.json
 * - Extracts project paths from the `projects` object keys
 * - Normalizes paths (converts backslashes to forward slashes)
 * - Deduplicates paths that point to the same directory
 * - Filters out paths that no longer exist on disk
 * - Returns a sorted list of Project objects (name from directory basename)
 *
 * Returns an empty array if ~/.claude.json is missing or malformed.
 */
export async function discoverProjects(): Promise<Project[]> {
  const homeDir = os.homedir();
  const claudeJsonPath = path.join(homeDir, '.claude.json');

  const data = readClaudeJson(claudeJsonPath);
  if (!data) {
    return [];
  }

  const projects = data['projects'];
  if (
    typeof projects !== 'object' ||
    projects === null ||
    Array.isArray(projects)
  ) {
    return [];
  }

  const rawPaths = Object.keys(projects as Record<string, unknown>);

  // Normalize all paths and deduplicate
  const seen = new Set<string>();
  const uniquePaths: string[] = [];

  for (const rawPath of rawPaths) {
    const normalized = normalizePath(rawPath);
    // Use a lowercase key for case-insensitive deduplication on Windows
    const dedupeKey = normalized.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      uniquePaths.push(normalized);
    }
  }

  // Filter to paths that exist on disk and build Project objects
  const result: Project[] = [];

  for (const normalizedPath of uniquePaths) {
    // For existence check, use the normalized path directly — Node.js accepts
    // forward-slash paths on Windows.
    if (!fs.existsSync(normalizedPath)) {
      continue;
    }

    const name = path.basename(normalizedPath);
    result.push({
      name,
      path: normalizedPath,
      skills: [],
    });
  }

  // Sort by name (case-insensitive)
  result.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  return result;
}
