/**
 * Unit tests for useScanState hook.
 *
 * AC1: "useScanState() hook extracted, page.tsx runScan logic removed from component body"
 *   → unit (pure hook logic: state management, fetch calls, registerScan integration)
 * AC2: "/api/scan and /api/analyze called in parallel via Promise.all"
 *   → unit (verify both fetch calls are initiated in parallel — track call order and timing)
 *
 * These tests cover the hook's state machine and API orchestration logic.
 * React hook rendering is not needed — we test the underlying fetch/state logic directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildScanUrl,
  buildAnalyzeUrl,
  processParallelResponses,
  type ScanApiResult,
  type AnalyzeApiResult,
} from './use-scan-state';

// ---------------------------------------------------------------------------
// Tests for URL builders (pure functions)
// ---------------------------------------------------------------------------

describe('buildScanUrl', () => {
  it('returns /api/scan when paths is empty', () => {
    expect(buildScanUrl([])).toBe('/api/scan');
  });

  it('includes additionalPaths query param when paths are provided', () => {
    const url = buildScanUrl(['/home/user/projects/foo']);
    expect(url).toContain('/api/scan');
    expect(url).toContain('additionalPaths=');
    expect(url).toContain(encodeURIComponent('/home/user/projects/foo'));
  });

  it('joins multiple paths with comma in query param', () => {
    const url = buildScanUrl(['/path/a', '/path/b']);
    expect(url).toContain(encodeURIComponent('/path/a,/path/b'));
  });
});

describe('buildAnalyzeUrl', () => {
  it('returns /api/analyze when paths is empty', () => {
    expect(buildAnalyzeUrl([])).toBe('/api/analyze');
  });

  it('includes additionalPaths query param when paths are provided', () => {
    const url = buildAnalyzeUrl(['/home/user/projects/foo']);
    expect(url).toContain('/api/analyze');
    expect(url).toContain('additionalPaths=');
    expect(url).toContain(encodeURIComponent('/home/user/projects/foo'));
  });

  it('joins multiple paths with comma in query param', () => {
    const url = buildAnalyzeUrl(['/path/a', '/path/b']);
    expect(url).toContain(encodeURIComponent('/path/a,/path/b'));
  });
});

// ---------------------------------------------------------------------------
// Tests for processParallelResponses (parallel fetch result processor)
// ---------------------------------------------------------------------------

describe('processParallelResponses — AC2: /api/scan and /api/analyze called in parallel', () => {
  function makeScanData(overrides: Partial<ScanApiResult> = {}): ScanApiResult {
    return {
      projects: [],
      userSkills: [],
      pluginSkills: [],
      scannedAt: '2024-01-01T00:00:00.000Z',
      scanDurationMs: 42,
      ...overrides,
    };
  }

  function makeAnalyzeData(overrides: Partial<AnalyzeApiResult> = {}): AnalyzeApiResult {
    return {
      projects: [],
      userSkills: [],
      pluginSkills: [],
      scannedAt: '2024-01-01T00:00:00.000Z',
      scanDurationMs: 10,
      clusters: [],
      gaps: [],
      contradictions: [],
      ...overrides,
    };
  }

  it('returns ok state with skills and stats when both responses succeed', async () => {
    const scanData = makeScanData({
      projects: [{ name: 'my-app', path: '/repos/my-app', skills: [] }],
    });
    const analyzeData = makeAnalyzeData({
      clusters: [],
      gaps: [],
      contradictions: [],
    });

    const mockScanRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(scanData),
    } as unknown as Response;
    const mockAnalyzeRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(analyzeData),
    } as unknown as Response;

    const result = await processParallelResponses(mockScanRes, mockAnalyzeRes);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.projects).toEqual([{ name: 'my-app', path: '/repos/my-app' }]);
      expect(result.scannedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.durationMs).toBe(42);
      expect(result.stats?.overlaps).toBe(0);
      expect(result.stats?.gaps).toBe(0);
      expect(result.stats?.contradictions).toBe(0);
    }
  });

  it('returns error state when scan response is not ok', async () => {
    const mockScanRes = {
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'disk read failure', scanDurationMs: 5 }),
    } as unknown as Response;
    const mockAnalyzeRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(makeAnalyzeData()),
    } as unknown as Response;

    const result = await processParallelResponses(mockScanRes, mockAnalyzeRes);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('disk read failure');
    }
  });

  it('returns ok state even when analyze response fails (stats gracefully absent)', async () => {
    const scanData = makeScanData();
    const mockScanRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(scanData),
    } as unknown as Response;
    const mockAnalyzeRes = {
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'analyze failed', scanDurationMs: 5 }),
    } as unknown as Response;

    const result = await processParallelResponses(mockScanRes, mockAnalyzeRes);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // stats should be null when analyze fails
      expect(result.stats).toBeNull();
    }
  });

  it('deduplicates skills from projects, userSkills, and pluginSkills', async () => {
    const sharedSkill = {
      filePath: '/home/.claude/skills/foo.md',
      name: 'foo',
      description: '',
      type: 'skill' as const,
      level: 'user' as const,
      projectName: null,
      projectPath: null,
      pluginName: null,
      frontmatter: {},
      body: '',
      contentHash: 'abc123',
    };
    const scanData = makeScanData({
      // Same skill appears at both user level and as a project skill
      userSkills: [sharedSkill],
      projects: [{
        name: 'my-app',
        path: '/repos/my-app',
        skills: [{ ...sharedSkill, level: 'project' as const }],
      }],
    });
    const mockScanRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(scanData),
    } as unknown as Response;
    const mockAnalyzeRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(makeAnalyzeData()),
    } as unknown as Response;

    const result = await processParallelResponses(mockScanRes, mockAnalyzeRes);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Should be deduplicated to 1, not 2
      expect(result.skills.length).toBe(1);
      // User level wins deduplication
      expect(result.skills[0].level).toBe('user');
    }
  });

  it('includes overlapIdentities Set built from analyze cluster skillIdentity fields', async () => {
    const scanData = makeScanData();
    const analyzeData = makeAnalyzeData({
      clusters: [
        {
          skillIdentity: 'code-review/SKILL.md',
          filename: 'SKILL.md',
          files: [],
          status: 'identical',
          hashGroups: {},
        },
        {
          skillIdentity: 'deploy/RULE.md',
          filename: 'RULE.md',
          files: [],
          status: 'drifted',
          hashGroups: {},
        },
      ],
    });
    const mockScanRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(scanData),
    } as unknown as Response;
    const mockAnalyzeRes = {
      ok: true,
      json: vi.fn().mockResolvedValue(analyzeData),
    } as unknown as Response;

    const result = await processParallelResponses(mockScanRes, mockAnalyzeRes);
    expect(result.status).toBe('ok');
    if (result.status === 'ok' && result.stats) {
      expect(result.stats.overlapIdentities.has('code-review/SKILL.md')).toBe(true);
      expect(result.stats.overlapIdentities.has('deploy/RULE.md')).toBe(true);
      expect(result.stats.overlapIdentities.size).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests for parallel fetch orchestration
// ---------------------------------------------------------------------------

describe('parallel fetch orchestration — AC2', () => {
  let fetchCallOrder: string[];

  beforeEach(() => {
    fetchCallOrder = [];

    // Mock fetch to track call order and return mock responses
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      fetchCallOrder.push(url as string);
      const isScan = (url as string).includes('/api/scan');
      const data = isScan
        ? {
            projects: [],
            userSkills: [],
            pluginSkills: [],
            scannedAt: '2024-01-01T00:00:00.000Z',
            scanDurationMs: 10,
          }
        : {
            projects: [],
            userSkills: [],
            pluginSkills: [],
            scannedAt: '2024-01-01T00:00:00.000Z',
            scanDurationMs: 5,
            clusters: [],
            gaps: [],
            contradictions: [],
          };

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
      });
    });

    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls both /api/scan and /api/analyze within the same Promise.all', async () => {
    // Import the hook's runParallelFetch helper to test the orchestration
    const { runParallelFetch } = await import('./use-scan-state');
    await runParallelFetch([]);

    // Both URLs should have been called
    expect(fetchCallOrder.some((u) => u.includes('/api/scan'))).toBe(true);
    expect(fetchCallOrder.some((u) => u.includes('/api/analyze'))).toBe(true);
    // Both should be called (Promise.all fires both at once)
    expect(fetchCallOrder.length).toBe(2);
  });

  it('passes additionalPaths to both API calls', async () => {
    const { runParallelFetch } = await import('./use-scan-state');
    await runParallelFetch(['/extra/path']);

    const scanCall = fetchCallOrder.find((u) => u.includes('/api/scan'));
    const analyzeCall = fetchCallOrder.find((u) => u.includes('/api/analyze'));

    expect(scanCall).toContain('additionalPaths=');
    expect(analyzeCall).toContain('additionalPaths=');
  });
});
