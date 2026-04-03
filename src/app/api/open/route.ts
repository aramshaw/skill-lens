/**
 * POST /api/open
 *
 * Opens a skill file in the user's default application for .md files.
 * Uses the appropriate OS command:
 *   - Windows: start "" "<filePath>"
 *   - macOS:   open "<filePath>"
 *   - Linux:   xdg-open "<filePath>"
 *
 * Request body:
 *   { filePath: string }
 *
 * Response (200):
 *   { success: true }
 *
 * Response (400):
 *   { error: string }  — missing or invalid filePath
 *
 * Response (403):
 *   { error: string }  — filePath is outside allowed directories
 *
 * Response (500):
 *   { error: string }  — OS command failed
 *
 * Security: filePath is validated to be within known project paths or
 * the user-level ~/.claude directory. Path traversal is blocked by
 * resolving to an absolute path before checking.
 */

import { exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { NextResponse } from 'next/server';
import { discoverProjects } from '@/lib/scanner/discover';

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/**
 * Normalize a path to forward slashes and resolve it to an absolute path.
 * This blocks traversal attacks (../../etc/passwd).
 */
function resolveAndNormalize(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

/**
 * Check whether `filePath` is nested inside `allowedDir`.
 * Uses a strict prefix match with a trailing slash to prevent
 * prefix-only attacks (e.g. /home/user/repos/proj-evil when proj is allowed).
 */
function isInsideDir(filePath: string, allowedDir: string): boolean {
  const resolvedFile = resolveAndNormalize(filePath);
  const resolvedDir = resolveAndNormalize(allowedDir);
  const dirWithSlash = resolvedDir.endsWith('/') ? resolvedDir : `${resolvedDir}/`;
  return resolvedFile.startsWith(dirWithSlash);
}

/**
 * Validate that filePath is inside one of the allowed locations:
 *   1. Any discovered project directory
 *   2. The user-level ~/.claude directory
 *
 * Returns true if allowed, false otherwise.
 */
async function validateFilePath(filePath: string): Promise<boolean> {
  const homeDir = os.homedir().replace(/\\/g, '/');
  const userClaudeDir = `${homeDir}/.claude`;

  // Check user-level ~/.claude directory
  if (isInsideDir(filePath, userClaudeDir)) {
    return true;
  }

  // Check known project directories
  const projects = await discoverProjects();
  for (const project of projects) {
    if (isInsideDir(filePath, project.path)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// OS command builder
// ---------------------------------------------------------------------------

/**
 * Build the shell command to open a file with the default application.
 * The file path is quoted to handle spaces.
 */
function buildOpenCommand(filePath: string): string {
  const platform = os.platform();
  // Escape double quotes in the path to prevent command injection
  const safePath = filePath.replace(/"/g, '\\"');

  if (platform === 'win32') {
    // start "" opens with default handler; empty title required when path has spaces
    return `start "" "${safePath}"`;
  } else if (platform === 'darwin') {
    return `open "${safePath}"`;
  } else {
    return `xdg-open "${safePath}"`;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate filePath field
  if (
    typeof body !== 'object' ||
    body === null ||
    !('filePath' in body) ||
    typeof (body as Record<string, unknown>)['filePath'] !== 'string'
  ) {
    return NextResponse.json(
      { error: 'filePath is required and must be a string' },
      { status: 400 }
    );
  }

  const filePath = ((body as Record<string, unknown>)['filePath'] as string).trim();

  if (filePath.length === 0) {
    return NextResponse.json({ error: 'filePath must not be empty' }, { status: 400 });
  }

  // Security: validate path is within allowed directories
  const allowed = await validateFilePath(filePath);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Access denied: filePath is outside allowed directories' },
      { status: 403 }
    );
  }

  // Build and execute the OS-appropriate open command
  const command = buildOpenCommand(filePath);

  return new Promise<NextResponse>((resolve) => {
    exec(command, (error) => {
      if (error) {
        console.error('[skill-lens] /api/open exec error:', error.message);
        resolve(
          NextResponse.json(
            { error: `Failed to open file: ${error.message}` },
            { status: 500 }
          )
        );
      } else {
        resolve(NextResponse.json({ success: true }));
      }
    });
  });
}
