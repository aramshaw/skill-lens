/**
 * Integration tests for GET /api/scan
 *
 * AC1: "GET /api/scan returns valid ScanResult JSON" → integration (API route handler, direct call)
 * AC2: "Response includes scannedAt timestamp and scanDurationMs" → integration (API route handler)
 * AC3: "Handles errors gracefully (returns partial results + error messages)" → integration (error handling)
 * AC4: "Works on Windows paths" → covered at scanner layer; acceptance here is that paths pass through
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the scanner modules so tests don't touch the real filesystem
vi.mock('@/lib/scanner/discover', () => ({
  discoverProjects: vi.fn(),
}));

vi.mock('@/lib/scanner/scan', () => ({
  scanAll: vi.fn(),
}));

import { discoverProjects } from '@/lib/scanner/discover';
import { scanAll } from '@/lib/scanner/scan';
import { GET } from './route';
import type { Project, ScanResult } from '@/lib/types';

const mockDiscoverProjects = vi.mocked(discoverProjects);
const mockScanAll = vi.mocked(scanAll);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(name: string, projectPath: string): Project {
  return { name, path: projectPath, skills: [] };
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

/** Parse the JSON body from a Response object. */
async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

beforeEach(() => {
  vi.resetAllMocks();
  mockDiscoverProjects.mockResolvedValue([]);
  mockScanAll.mockResolvedValue(makeScanResult());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC1: Returns valid ScanResult JSON
// ---------------------------------------------------------------------------

describe('GET /api/scan — response shape', () => {
  it('returns HTTP 200', async () => {
    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);

    expect(response.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);

    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('response body contains projects, userSkills, pluginSkills, scannedAt', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];
    mockDiscoverProjects.mockResolvedValue(projects);
    mockScanAll.mockResolvedValue(
      makeScanResult({ projects, userSkills: [], pluginSkills: [] })
    );

    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('userSkills');
    expect(body).toHaveProperty('pluginSkills');
    expect(body).toHaveProperty('scannedAt');
  });

  it('passes discovered projects to scanAll', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];
    mockDiscoverProjects.mockResolvedValue(projects);
    mockScanAll.mockResolvedValue(makeScanResult({ projects }));

    const req = new Request('http://localhost:3000/api/scan');
    await GET(req);

    expect(mockScanAll).toHaveBeenCalledWith(projects, []);
  });
});

// ---------------------------------------------------------------------------
// AC2: Response includes scannedAt and scanDurationMs
// ---------------------------------------------------------------------------

describe('GET /api/scan — timing fields', () => {
  it('response includes scanDurationMs as a non-negative number', async () => {
    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body).toHaveProperty('scanDurationMs');
    expect(typeof body['scanDurationMs']).toBe('number');
    expect(body['scanDurationMs'] as number).toBeGreaterThanOrEqual(0);
  });

  it('response includes scannedAt as an ISO 8601 string', async () => {
    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(typeof body['scannedAt']).toBe('string');
    expect(body['scannedAt'] as string).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// AC3: Handles errors gracefully
// ---------------------------------------------------------------------------

describe('GET /api/scan — error handling', () => {
  it('returns HTTP 500 with error message when discoverProjects throws', async () => {
    mockDiscoverProjects.mockRejectedValue(new Error('disk read failure'));

    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);

    expect(response.status).toBe(500);

    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    expect(typeof body['error']).toBe('string');
  });

  it('returns HTTP 500 with error message when scanAll throws', async () => {
    mockDiscoverProjects.mockResolvedValue([]);
    mockScanAll.mockRejectedValue(new Error('scan exploded'));

    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);

    expect(response.status).toBe(500);

    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('error response still includes scanDurationMs', async () => {
    mockDiscoverProjects.mockRejectedValue(new Error('oops'));

    const req = new Request('http://localhost:3000/api/scan');
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;

    expect(body).toHaveProperty('scanDurationMs');
    expect(typeof body['scanDurationMs']).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// additionalPaths query param
// ---------------------------------------------------------------------------

describe('GET /api/scan — additionalPaths query param', () => {
  it('passes additionalPaths to scanAll when provided as comma-separated query param', async () => {
    mockDiscoverProjects.mockResolvedValue([]);
    mockScanAll.mockResolvedValue(makeScanResult());

    const req = new Request(
      'http://localhost:3000/api/scan?additionalPaths=/extra/path1,/extra/path2'
    );
    await GET(req);

    expect(mockScanAll).toHaveBeenCalledWith([], ['/extra/path1', '/extra/path2']);
  });

  it('passes empty additionalPaths when query param is absent', async () => {
    const req = new Request('http://localhost:3000/api/scan');
    await GET(req);

    expect(mockScanAll).toHaveBeenCalledWith([], []);
  });

  it('filters out empty strings from additionalPaths', async () => {
    const req = new Request('http://localhost:3000/api/scan?additionalPaths=,/valid/path,');
    await GET(req);

    expect(mockScanAll).toHaveBeenCalledWith([], ['/valid/path']);
  });
});
