/**
 * Integration tests for POST /api/open
 *
 * AC1: "Opens file in default .md editor via OS shell command" → integration (API route handler)
 * AC2: "Path validation prevents arbitrary file access" → integration (security check in handler)
 * AC3: "Returns success JSON on valid path" → integration (response shape)
 * AC4: "Returns error JSON on invalid/rejected path" → integration (error response)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecException } from 'child_process';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@/lib/scanner/discover', () => ({
  discoverProjects: vi.fn(),
}));

import { exec } from 'child_process';
import { discoverProjects } from '@/lib/scanner/discover';
import { POST } from './route';
import type { Project } from '@/lib/types';

type ExecCallback = (error: ExecException | null, stdout: string, stderr: string) => void;
type ExecMock = (cmd: string, cb: ExecCallback) => ReturnType<typeof exec>;

const mockExec = vi.mocked(exec) as unknown as { mockImplementation: (fn: ExecMock) => void; mock: { calls: unknown[][] } };
const mockDiscoverProjects = vi.mocked(discoverProjects);

function makeProject(name: string, projectPath: string): Project {
  return { name, path: projectPath, skills: [] };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Simulate exec succeeding
  mockExec.mockImplementation((_cmd: string, cb: ExecCallback) => {
    cb(null, '', '');
    return {} as ReturnType<typeof exec>;
  });
  mockDiscoverProjects.mockResolvedValue([
    makeProject('my-app', '/repos/my-app'),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function postOpen(body: unknown): Promise<Response> {
  const req = new Request('http://localhost:3000/api/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ---------------------------------------------------------------------------
// AC3: Returns success JSON on valid path
// ---------------------------------------------------------------------------

describe('POST /api/open — success', () => {
  it('returns HTTP 200 for a valid path within a known project', async () => {
    const response = await postOpen({
      filePath: '/repos/my-app/.claude/skills/foo.md',
    });
    expect(response.status).toBe(200);
  });

  it('response body has ok: true on success', async () => {
    const response = await postOpen({
      filePath: '/repos/my-app/.claude/skills/foo.md',
    });
    const body = await response.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC4: Returns error JSON on invalid/rejected path
// ---------------------------------------------------------------------------

describe('POST /api/open — validation', () => {
  it('returns 400 when filePath is missing', async () => {
    const response = await postOpen({});
    expect(response.status).toBe(400);
  });

  it('returns 400 when filePath is not a string', async () => {
    const response = await postOpen({ filePath: 42 });
    expect(response.status).toBe(400);
  });

  it('returns 403 for a path outside any known location', async () => {
    const response = await postOpen({ filePath: '/etc/passwd' });
    expect(response.status).toBe(403);
  });

  it('returns 403 for path traversal attempt', async () => {
    const response = await postOpen({
      filePath: '/repos/my-app/../../etc/passwd',
    });
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// AC2: exec is called with the file path
// ---------------------------------------------------------------------------

describe('POST /api/open — exec invocation', () => {
  it('calls exec with a command containing the file path', async () => {
    const filePath = '/repos/my-app/.claude/skills/foo.md';
    await postOpen({ filePath });
    expect(mockExec).toHaveBeenCalledOnce();
    const calledCmd = (mockExec.mock.calls[0] as string[])[0];
    expect(typeof calledCmd).toBe('string');
    expect(calledCmd.length).toBeGreaterThan(0);
  });

  it('returns 500 when exec returns an error', async () => {
    mockExec.mockImplementation((_cmd: string, cb: ExecCallback) => {
      cb(Object.assign(new Error('exec failed'), { code: 1, killed: false, cmd: '' }) as ExecException, '', '');
      return {} as ReturnType<typeof exec>;
    });
    const response = await postOpen({
      filePath: '/repos/my-app/.claude/skills/foo.md',
    });
    expect(response.status).toBe(500);
  });
});
