/**
 * GET /api/analyze
 *
 * Runs the full scan pipeline, then analyzes overlaps across all discovered
 * skill files. Returns the ScanResult extended with overlap clusters and timing.
 *
 * Query params:
 *   additionalPaths — comma-separated list of extra directories to scan
 *
 * Response (200):
 *   ScanResult & { clusters: OverlapCluster[]; scanDurationMs: number }
 *
 * Response (500):
 *   { error: string; scanDurationMs: number }
 */

import { NextResponse } from 'next/server';
import { discoverProjects } from '@/lib/scanner/discover';
import { scanAll } from '@/lib/scanner/scan';
import { buildOverlapClusters } from '@/lib/analyzer/overlaps';
import type { ScanResult, OverlapCluster, SkillFile } from '@/lib/types';

export interface AnalyzeResponse extends ScanResult {
  clusters: OverlapCluster[];
  scanDurationMs: number;
}

export interface AnalyzeErrorResponse {
  error: string;
  scanDurationMs: number;
}

export async function GET(
  request: Request
): Promise<NextResponse<AnalyzeResponse | AnalyzeErrorResponse>> {
  const startMs = Date.now();

  const { searchParams } = new URL(request.url);
  const additionalPathsParam = searchParams.get('additionalPaths') ?? '';
  const additionalPaths = additionalPathsParam
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  try {
    const projects = await discoverProjects();
    const result = await scanAll(projects, additionalPaths);

    // Flatten all skill files for overlap analysis
    const allFiles: SkillFile[] = [
      ...result.projects.flatMap((p) => p.skills),
      ...result.userSkills,
      ...result.pluginSkills,
    ];

    const rawClusters = buildOverlapClusters(allFiles);

    // Sort: drifted first, then by number of copies descending
    const clusters = [...rawClusters].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'drifted' ? -1 : 1;
      }
      return b.files.length - a.files.length;
    });

    const scanDurationMs = Date.now() - startMs;

    return NextResponse.json<AnalyzeResponse>({
      ...result,
      clusters,
      scanDurationMs,
    });
  } catch (err) {
    const scanDurationMs = Date.now() - startMs;
    const message =
      err instanceof Error ? err.message : 'Unknown error during analysis';

    console.error('[skill-lens] /api/analyze error:', message);

    return NextResponse.json<AnalyzeErrorResponse>(
      { error: message, scanDurationMs },
      { status: 500 }
    );
  }
}
