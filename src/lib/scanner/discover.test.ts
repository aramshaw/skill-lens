/**
 * Tests for discoverProjects()
 *
 * AC1: "discoverProjects() returns Project[]" → unit (pure filesystem logic)
 * AC2: "Works on Windows paths" → unit (path normalization logic)
 * AC3: "Handles missing/malformed .claude.json gracefully" → unit (error handling)
 * AC4: "Filters non-existent directories" → unit (filesystem existence check)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs and os so we don't touch the real filesystem
vi.mock('fs');
vi.mock('os');

// Import after mocking
import { discoverProjects } from './discover';

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

beforeEach(() => {
  vi.resetAllMocks();
  mockOs.homedir.mockReturnValue('C:\\Users\\TestUser');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverProjects', () => {
  it('returns empty array when .claude.json does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = await discoverProjects();

    expect(result).toEqual([]);
  });

  it('returns empty array when .claude.json is malformed JSON', async () => {
    mockFs.existsSync.mockImplementation((p) => {
      return String(p).endsWith('.claude.json');
    });
    mockFs.readFileSync.mockReturnValue('not valid json {{{{');

    const result = await discoverProjects();

    expect(result).toEqual([]);
  });

  it('returns empty array when .claude.json has no projects key', async () => {
    mockFs.existsSync.mockImplementation((p) => {
      return String(p).endsWith('.claude.json');
    });
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ numStartups: 1 }));

    const result = await discoverProjects();

    expect(result).toEqual([]);
  });

  it('returns empty array when projects object is empty', async () => {
    mockFs.existsSync.mockImplementation((p) => {
      return String(p).endsWith('.claude.json');
    });
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ projects: {} }));

    const result = await discoverProjects();

    expect(result).toEqual([]);
  });

  it('filters out project paths that do not exist on disk', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\existing-project': {},
        'C:\\Users\\TestUser\\Repos\\missing-project': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('.claude.json') || s.includes('existing-project');
    });

    const result = await discoverProjects();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('existing-project');
  });

  it('derives project name from directory basename', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\my-cool-app': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockReturnValue(true);

    const result = await discoverProjects();

    expect(result[0].name).toBe('my-cool-app');
  });

  it('normalizes Windows backslash paths to forward slashes', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\my-app': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockReturnValue(true);

    const result = await discoverProjects();

    expect(result[0].path).not.toContain('\\');
    expect(result[0].path).toContain('/');
  });

  it('deduplicates paths that differ only in separator style', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\my-app': {},
        'C:/Users/TestUser/Repos/my-app': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockReturnValue(true);

    const result = await discoverProjects();

    expect(result).toHaveLength(1);
  });

  it('returns projects sorted by name', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\zebra-project': {},
        'C:\\Users\\TestUser\\Repos\\alpha-project': {},
        'C:\\Users\\TestUser\\Repos\\mango-project': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockReturnValue(true);

    const result = await discoverProjects();

    expect(result.map((p) => p.name)).toEqual([
      'alpha-project',
      'mango-project',
      'zebra-project',
    ]);
  });

  it('returns Project objects with correct shape', async () => {
    const claudeJson = JSON.stringify({
      projects: {
        'C:\\Users\\TestUser\\Repos\\my-app': {},
      },
    });

    mockFs.readFileSync.mockReturnValue(claudeJson);
    mockFs.existsSync.mockReturnValue(true);

    const result = await discoverProjects();

    expect(result[0]).toMatchObject({
      name: 'my-app',
      path: expect.stringContaining('my-app'),
      skills: [],
    });
  });

  it('uses os.homedir() to locate .claude.json', async () => {
    mockOs.homedir.mockReturnValue('/home/testuser');
    mockFs.existsSync.mockReturnValue(false);

    await discoverProjects();

    expect(mockOs.homedir).toHaveBeenCalled();
    expect(mockFs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('.claude.json')
    );
  });
});
