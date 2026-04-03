/**
 * Integration tests for GET /api/claude-md
 *
 * AC1: "CLAUDE.md content displayed when viewing a project" → integration (API route handler)
 * AC2: "Both user and project level shown if both exist" → integration (API route handler)
 * AC3: "Returns 404 when no CLAUDE.md exists at either level" → integration (error response)
 * AC4: "Returns 400 when projectPath param is missing" → integration (validation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}));

import * as fs from 'fs';
import { GET } from './route';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/claude-md');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

// ---------------------------------------------------------------------------
// AC4: Input validation
// ---------------------------------------------------------------------------

describe('GET /api/claude-md — validation', () => {
  it('returns 400 when projectPath param is missing', async () => {
    const req = makeRequest({});
    const response = await GET(req);
    expect(response.status).toBe(400);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// AC3: 404 when neither CLAUDE.md exists
// ---------------------------------------------------------------------------

describe('GET /api/claude-md — not found', () => {
  it('returns 404 when neither user nor project CLAUDE.md exists', async () => {
    mockExistsSync.mockReturnValue(false);

    const req = makeRequest({ projectPath: '/repos/my-app' });
    const response = await GET(req);
    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC2: Content returned when files exist
// ---------------------------------------------------------------------------

describe('GET /api/claude-md — content', () => {
  it('returns projectContent when project CLAUDE.md exists', async () => {
    mockExistsSync.mockImplementation((p) => {
      return String(p).includes('/repos/my-app/CLAUDE.md');
    });
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('/repos/my-app/CLAUDE.md')) return '# Project Docs\nHello';
      return '';
    });

    const req = makeRequest({ projectPath: '/repos/my-app' });
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('projectContent', '# Project Docs\nHello');
    expect(body).toHaveProperty('userContent', null);
  });

  it('returns userContent when user-level CLAUDE.md exists', async () => {
    mockExistsSync.mockImplementation((p) => {
      return String(p).includes('/home/user/.claude/CLAUDE.md');
    });
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('/home/user/.claude/CLAUDE.md')) return '# Global Rules';
      return '';
    });

    const req = makeRequest({ projectPath: '/repos/my-app' });
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('userContent', '# Global Rules');
    expect(body).toHaveProperty('projectContent', null);
  });

  it('returns both userContent and projectContent when both exist', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('/repos/my-app/CLAUDE.md')) return '# Project';
      if (String(p).includes('/home/user/.claude/CLAUDE.md')) return '# User';
      return '';
    });

    const req = makeRequest({ projectPath: '/repos/my-app' });
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('projectContent', '# Project');
    expect(body).toHaveProperty('userContent', '# User');
  });

  it('response includes projectPath and userClaudeMdPath fields', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('# Content');

    const req = makeRequest({ projectPath: '/repos/my-app' });
    const response = await GET(req);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('projectClaudeMdPath');
    expect(body).toHaveProperty('userClaudeMdPath');
  });
});
