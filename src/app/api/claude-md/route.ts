/**
 * GET /api/claude-md
 *
 * Returns the content of CLAUDE.md files for a given project path.
 * Reads both user-level (~/.claude/CLAUDE.md) and project-level
 * (<projectPath>/CLAUDE.md) if they exist.
 *
 * Query params:
 *   projectPath — absolute path to the project root directory (required)
 *
 * Response (200):
 *   {
 *     projectContent: string | null;       // project-level CLAUDE.md content
 *     userContent: string | null;          // user-level CLAUDE.md content
 *     projectClaudeMdPath: string;         // absolute path (may not exist)
 *     userClaudeMdPath: string;            // absolute path (may not exist)
 *   }
 *
 * Response (400): { error: string } — missing required param
 * Response (404): { error: string } — neither file exists
 * Response (500): { error: string } — unexpected read error
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface ClaudeMdResponse {
  projectContent: string | null;
  userContent: string | null;
  projectClaudeMdPath: string;
  userClaudeMdPath: string;
}

export interface ClaudeMdErrorResponse {
  error: string;
}

/**
 * Safely read a file, returning null if it doesn't exist or cannot be read.
 */
function safeRead(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8') as string;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request
): Promise<NextResponse<ClaudeMdResponse | ClaudeMdErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('projectPath');

  if (!projectPath) {
    return NextResponse.json<ClaudeMdErrorResponse>(
      { error: 'projectPath query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const homeDir = os.homedir().replace(/\\/g, '/');
    const userClaudeMdPath = path.join(homeDir, '.claude', 'CLAUDE.md').replace(/\\/g, '/');
    const projectClaudeMdPath = path.join(projectPath, 'CLAUDE.md').replace(/\\/g, '/');

    const userContent = safeRead(userClaudeMdPath);
    const projectContent = safeRead(projectClaudeMdPath);

    if (userContent === null && projectContent === null) {
      return NextResponse.json<ClaudeMdErrorResponse>(
        { error: 'No CLAUDE.md found at user or project level' },
        { status: 404 }
      );
    }

    return NextResponse.json<ClaudeMdResponse>({
      projectContent,
      userContent,
      projectClaudeMdPath,
      userClaudeMdPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[skill-lens] /api/claude-md error:', message);
    return NextResponse.json<ClaudeMdErrorResponse>(
      { error: message },
      { status: 500 }
    );
  }
}
