/**
 * POST /api/open
 *
 * Opens a skill file in the OS default editor.
 *
 * Request body: { filePath: string }
 *
 * Response (200): { ok: true }
 * Response (400): { error: string }  — missing/invalid body
 * Response (403): { error: string }  — path outside allowed locations
 * Response (500): { error: string }  — exec failed
 *
 * Security: validates that the filePath is within a known project path,
 * user-level ~/.claude directory, or the current working directory.
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { discoverProjects } from '@/lib/scanner/discover';

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/**
 * Normalise a file path to a canonical POSIX-style absolute path
 * (resolves `..` components, normalises slashes).
 */
function normalise(p: string): string {
  return path.resolve(p).replace(/\\/g, '/');
}

/**
 * Returns true if `filePath` starts with `allowedRoot` (with trailing slash
 * guard to prevent /foo/bar matching /foo/baz).
 */
function isUnder(filePath: string, allowedRoot: string): boolean {
  const root = allowedRoot.endsWith('/') ? allowedRoot : allowedRoot + '/';
  return filePath.startsWith(root);
}

/**
 * Build the set of allowed root prefixes:
 *   - All known project paths (from ~/.claude.json)
 *   - The user-level ~/.claude directory
 *   - The app's working directory (for dev convenience)
 */
async function allowedRoots(): Promise<string[]> {
  const homeDir = os.homedir().replace(/\\/g, '/');
  const userClaudeDir = homeDir + '/.claude';

  let projectPaths: string[] = [];
  try {
    const projects = await discoverProjects();
    projectPaths = projects.map((p) => normalise(p.path));
  } catch {
    // Ignore discovery errors — still allow user-level paths
  }

  return [userClaudeDir, ...projectPaths];
}

/**
 * Validates that the resolved filePath is within at least one allowed root.
 */
async function validatePath(filePath: string): Promise<boolean> {
  const resolved = normalise(filePath);
  const roots = await allowedRoots();
  return roots.some((root) => isUnder(resolved, normalise(root)));
}

// ---------------------------------------------------------------------------
// OS command builder
// ---------------------------------------------------------------------------

function buildOpenCommand(filePath: string): string {
  const quoted = `"${filePath.replace(/"/g, '\\"')}"`;
  switch (process.platform) {
    case 'win32':
      // `start "" "<path>"` — empty title arg required when path has spaces
      return `start "" ${quoted}`;
    case 'darwin':
      return `open ${quoted}`;
    default:
      return `xdg-open ${quoted}`;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { filePath } = body as Record<string, unknown>;

  if (!filePath) {
    return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
  }

  if (typeof filePath !== 'string') {
    return NextResponse.json({ error: 'filePath must be a string' }, { status: 400 });
  }

  // 2. Validate path
  const allowed = await validatePath(filePath);
  if (!allowed) {
    return NextResponse.json(
      { error: 'filePath is outside allowed locations' },
      { status: 403 }
    );
  }

  // 3. Execute open command
  const cmd = buildOpenCommand(filePath);

  return new Promise<NextResponse>((resolve) => {
    exec(cmd, (err) => {
      if (err) {
        console.error('[skill-lens] /api/open exec error:', err.message);
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true }));
      }
    });
  });
}
