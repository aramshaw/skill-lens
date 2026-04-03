/**
 * Integration tests for GET /api/analyze
 *
 * AC1: "API route returns OverlapCluster[] alongside ScanResult" → integration (API route handler)
 * AC2: "Returns empty clusters array when no overlaps found" → integration
 * AC3: "Clusters are sorted: drifted first, then by copy count descending" → integration
 * AC4: "Returns HTTP 500 with error message when scan fails" → integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/scanner/discover', () => ({
  discoverProjects: vi.fn(),
}));

vi.mock('@/lib/scanner/scan', () => ({
  scanAll: vi.fn(),
}));

import { discoverProjects } from '@/lib/scanner/discover';
import { scanAll } from '@/lib/scanner/scan';
import { GET } from './route';
import type { Project, ScanResult, SkillFile } from '@/lib/types';

const mockDiscoverProjects = vi.mocked(discoverProjects);
const mockScanAll = vi.mocked(scanAll);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;

function makeSkillFile(overrides: Partial<SkillFile> & { filePath: string }): SkillFile {
  _counter += 1;
  return {
    name: `Skill ${_counter}`,
    description: '',
    type: 'skill',
    level: 'project',
    projectName: `project-${_counter}`,
    projectPath: `/repos/project-${_counter}`,
    frontmatter: {},
    body: 'body',
    contentHash: `hash-${_counter}`,
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    projects: [],
    userSkills: [],
    pluginSkills: [],
    scannedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

beforeEach(() => {
  vi.resetAllMocks();
  _counter = 0;
  mockDiscoverProjects.mockResolvedValue([]);
  mockScanAll.mockResolvedValue(makeScanResult());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC1: Returns OverlapCluster[] alongside ScanResult
// ---------------------------------------------------------------------------

describe('GET /api/analyze — response shape', () => {
  it('returns HTTP 200', async () => {
    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it('response body contains clusters, projects, userSkills, pluginSkills, scannedAt, scanDurationMs', async () => {
    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body).toHaveProperty('clusters');
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('userSkills');
    expect(body).toHaveProperty('pluginSkills');
    expect(body).toHaveProperty('scannedAt');
    expect(body).toHaveProperty('scanDurationMs');
    expect(Array.isArray(body['clusters'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2: Returns empty clusters when no overlaps
// ---------------------------------------------------------------------------

describe('GET /api/analyze — empty clusters', () => {
  it('returns empty clusters array when no files share a filename', async () => {
    const project: Project = {
      name: 'my-app',
      path: '/repos/my-app',
      skills: [
        makeSkillFile({ filePath: '/repos/my-app/.claude/skills/save/SKILL.md' }),
        makeSkillFile({ filePath: '/repos/my-app/.claude/rules/lint.md' }),
      ],
    };
    mockDiscoverProjects.mockResolvedValue([project]);
    mockScanAll.mockResolvedValue(makeScanResult({ projects: [project] }));

    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body['clusters']).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC3: Drifted clusters come first; tied status sorted by copy count desc
// ---------------------------------------------------------------------------

describe('GET /api/analyze — sort order', () => {
  it('puts drifted clusters before identical clusters', async () => {
    const sharedHash = 'same';
    const project1: Project = {
      name: 'project-a',
      path: '/repos/project-a',
      skills: [
        makeSkillFile({
          filePath: '/repos/project-a/.claude/skills/commit/SKILL.md',
          contentHash: sharedHash,
          projectName: 'project-a',
        }),
        makeSkillFile({
          filePath: '/repos/project-a/.claude/rules/lint.md',
          contentHash: 'hash-x',
          projectName: 'project-a',
        }),
      ],
    };
    const project2: Project = {
      name: 'project-b',
      path: '/repos/project-b',
      skills: [
        makeSkillFile({
          filePath: '/repos/project-b/.claude/skills/commit/SKILL.md',
          contentHash: sharedHash,
          projectName: 'project-b',
        }),
        makeSkillFile({
          filePath: '/repos/project-b/.claude/rules/lint.md',
          contentHash: 'hash-y', // different → drifted
          projectName: 'project-b',
        }),
      ],
    };
    mockDiscoverProjects.mockResolvedValue([project1, project2]);
    mockScanAll.mockResolvedValue(
      makeScanResult({ projects: [project1, project2] })
    );

    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;
    const clusters = body['clusters'] as Array<{ filename: string; status: string }>;

    expect(clusters.length).toBe(2);
    // drifted (lint.md) must come before identical (SKILL.md)
    expect(clusters[0].status).toBe('drifted');
    expect(clusters[1].status).toBe('identical');
  });
});

// ---------------------------------------------------------------------------
// AC4: Error handling
// ---------------------------------------------------------------------------

describe('GET /api/analyze — error handling', () => {
  it('returns HTTP 500 when scan fails', async () => {
    mockDiscoverProjects.mockRejectedValue(new Error('disk read failure'));

    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);

    expect(response.status).toBe(500);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('error response includes scanDurationMs', async () => {
    mockDiscoverProjects.mockRejectedValue(new Error('oops'));

    const req = new Request('http://localhost:3000/api/analyze');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body).toHaveProperty('scanDurationMs');
    expect(typeof body['scanDurationMs']).toBe('number');
  });
});
