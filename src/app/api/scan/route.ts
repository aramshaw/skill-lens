/**
 * GET /api/scan
 *
 * Runs the full scan pipeline and returns a ScanResult extended with timing info.
 *
 * Query params:
 *   additionalPaths — comma-separated list of extra directories to scan
 *
 * Response (200):
 *   ScanResult & { scanDurationMs: number }
 *
 * Response (500):
 *   { error: string; scanDurationMs: number }
 */

import { NextResponse } from 'next/server';
import { discoverProjects } from '@/lib/scanner/discover';
import { scanAll } from '@/lib/scanner/scan';
import type { ScanResult } from '@/lib/types';

export interface ScanResponse extends ScanResult {
  scanDurationMs: number;
}

export interface ScanErrorResponse {
  error: string;
  scanDurationMs: number;
}

export async function GET(
  request: Request
): Promise<NextResponse<ScanResponse | ScanErrorResponse>> {
  const startMs = Date.now();

  // Parse optional additionalPaths query param (comma-separated)
  const { searchParams } = new URL(request.url);
  const additionalPathsParam = searchParams.get('additionalPaths') ?? '';
  const additionalPaths = additionalPathsParam
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  try {
    const projects = await discoverProjects();
    const result = await scanAll(projects, additionalPaths);

    const scanDurationMs = Date.now() - startMs;

    return NextResponse.json<ScanResponse>({
      ...result,
      scanDurationMs,
    });
  } catch (err) {
    const scanDurationMs = Date.now() - startMs;
    const message =
      err instanceof Error ? err.message : 'Unknown error during scan';

    console.error('[skill-lens] /api/scan error:', message);

    return NextResponse.json<ScanErrorResponse>(
      { error: message, scanDurationMs },
      { status: 500 }
    );
  }
}
