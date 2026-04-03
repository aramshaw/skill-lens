/**
 * Integration tests for POST /api/open
 *
 * AC1: "Path validation prevents arbitrary file access" → integration (API route handler)
 * AC2: "Opens file in default editor on Windows/Mac/Linux" → integration (mocked child_process)
 * AC3: "Returns 200 on success, 400 on invalid path, 403 on out-of-bounds path" → integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock the scanner discover module for path validation
vi.mock('@/lib/scanner/discover', () => ({
  discoverProjects: vi.fn(),
}));

// Mock os module for platform detection
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    platform: vi.fn(() => 'linux'),
    homedir: vi.fn(() => '/home/testuser'),
  };
});

import { exec } from 'child_process';
import { discoverProjects } from '@/lib/scanner/discover';
import { POST } from './route';

// exec has complex overloads — cast to a simple callable for mocking
const mockExec = vi.mocked(exec) as unknown as ReturnType<typeof vi.fn>;
const mockDiscoverProjects = vi.mocked(discoverProjects);

/** Parse JSON from a Response. */
async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

/** Make a POST request to /api/open with a given body. */
function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  // Default: exec succeeds immediately
  mockExec.mockImplementation((_cmd: string, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    callback(null, '', '');
  });

  // Default: one known project at /home/testuser/repos/my-project
  mockDiscoverProjects.mockResolvedValue([
    {
      name: 'my-project',
      path: '/home/testuser/repos/my-project',
      skills: [],
    },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/open — input validation', () => {
  it('returns 400 when body is missing filePath', async () => {
    const req = makeRequest({});
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when filePath is not a string', async () => {
    const req = makeRequest({ filePath: 42 });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when filePath is empty string', async () => {
    const req = makeRequest({ filePath: '' });
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when request body is malformed JSON', async () => {
    const req = new Request('http://localhost:3000/api/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Path validation / security
// ---------------------------------------------------------------------------

describe('POST /api/open — path validation', () => {
  it('returns 403 when filePath is outside all known paths', async () => {
    mockDiscoverProjects.mockResolvedValue([
      { name: 'my-project', path: '/home/testuser/repos/my-project', skills: [] },
    ]);

    const req = makeRequest({ filePath: '/etc/passwd' });
    const response = await POST(req);

    expect(response.status).toBe(403);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('returns 403 for path traversal attempts', async () => {
    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project/../../etc/passwd',
    });
    const response = await POST(req);

    expect(response.status).toBe(403);
  });

  it('allows paths inside a known project directory', async () => {
    mockDiscoverProjects.mockResolvedValue([
      { name: 'my-project', path: '/home/testuser/repos/my-project', skills: [] },
    ]);

    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project/.claude/skills/my-skill.md',
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
  });

  it('allows paths inside user-level ~/.claude directory', async () => {
    mockDiscoverProjects.mockResolvedValue([]);

    const req = makeRequest({
      filePath: '/home/testuser/.claude/skills/my-skill.md',
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
  });

  it('rejects paths that start-with match but are actually outside (prefix attack)', async () => {
    mockDiscoverProjects.mockResolvedValue([
      { name: 'my-project', path: '/home/testuser/repos/my-project', skills: [] },
    ]);

    // /home/testuser/repos/my-project-evil starts with /home/testuser/repos/my-project
    // but is NOT inside it
    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project-evil/secret.md',
    });
    const response = await POST(req);

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Successful open
// ---------------------------------------------------------------------------

describe('POST /api/open — successful open', () => {
  it('returns 200 with success message on valid path', async () => {
    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project/.claude/skills/my-skill.md',
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
  });

  it('calls exec with the file path', async () => {
    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project/.claude/skills/my-skill.md',
    });
    await POST(req);

    expect(mockExec).toHaveBeenCalledOnce();
    const [cmd] = mockExec.mock.calls[0];
    expect(cmd).toContain('/home/testuser/repos/my-project/.claude/skills/my-skill.md');
  });
});

// ---------------------------------------------------------------------------
// Exec failure
// ---------------------------------------------------------------------------

describe('POST /api/open — exec failure', () => {
  it('returns 500 when exec fails', async () => {
    mockExec.mockImplementation((_cmd: string, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
      callback(new Error('command failed'), '', '');
    });

    const req = makeRequest({
      filePath: '/home/testuser/repos/my-project/.claude/skills/my-skill.md',
    });
    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await parseJson(response) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });
});
