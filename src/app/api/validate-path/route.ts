/**
 * POST /api/validate-path
 *
 * Checks whether a directory path exists on disk.
 *
 * Request body: { path: string }
 *
 * Response (200): { valid: true; resolvedPath: string }
 * Response (200): { valid: false; reason: string }
 * Response (400): { error: string }  — missing/invalid body
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ValidatePathSuccess {
  valid: true;
  resolvedPath: string;
}

export interface ValidatePathFailure {
  valid: false;
  reason: string;
}

export type ValidatePathResponse = ValidatePathSuccess | ValidatePathFailure;

export interface ValidatePathErrorResponse {
  error: string;
}

export async function POST(
  request: Request
): Promise<NextResponse<ValidatePathResponse | ValidatePathErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { path: dirPath } = body as Record<string, unknown>;

  if (!dirPath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  if (typeof dirPath !== 'string') {
    return NextResponse.json({ error: 'path must be a string' }, { status: 400 });
  }

  const trimmed = dirPath.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'path must not be empty' }, { status: 400 });
  }

  // Resolve to an absolute path (handles ~, relative paths, etc.)
  const resolvedPath = path.resolve(
    trimmed.replace(/^~/, process.env.HOME ?? process.env.USERPROFILE ?? '')
  );

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      return NextResponse.json<ValidatePathFailure>({
        valid: false,
        reason: 'Path exists but is not a directory',
      });
    }
    return NextResponse.json<ValidatePathSuccess>({
      valid: true,
      resolvedPath: resolvedPath.replace(/\\/g, '/'),
    });
  } catch {
    return NextResponse.json<ValidatePathFailure>({
      valid: false,
      reason: 'Directory does not exist or is not accessible',
    });
  }
}
