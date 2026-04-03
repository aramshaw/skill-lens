/**
 * Unit tests for scanAll()
 *
 * AC1: "scanAll(projects) returns ScanResult" → unit (pure filesystem logic, no HTTP/DOM)
 * AC2: "Discovers files at all three levels (user/project/plugin)" → unit (filesystem walking logic)
 * AC3: "Handles inaccessible directories gracefully (skip, don't crash)" → unit (error handling)
 * AC4: "Logs scan stats (N skills, N agents, N rules found)" → unit (console.log verification)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

// Mock fs, os, and fast-glob so tests don't touch the real filesystem
vi.mock('fs');
vi.mock('os');

// We mock fast-glob as a named module
vi.mock('fast-glob', () => ({
  default: vi.fn(),
}));

// Also mock the parser so we don't test it again here
vi.mock('@/lib/parser/parse', () => ({
  parseSkillFile: vi.fn(),
}));

import fg from 'fast-glob';
import { parseSkillFile } from '@/lib/parser/parse';
import { scanAll } from './scan';
import type { Project, SkillFile } from '@/lib/types';

const mockFg = vi.mocked(fg);
const mockParseSkillFile = vi.mocked(parseSkillFile);
const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(name: string, projectPath: string): Project {
  return { name, path: projectPath, skills: [] };
}

function makeSkillFile(overrides: Partial<SkillFile> = {}): SkillFile {
  return {
    filePath: '/some/path/SKILL.md',
    name: 'Test Skill',
    description: 'A test skill',
    type: 'skill',
    level: 'user',
    projectName: null,
    projectPath: null,
    frontmatter: {},
    body: 'body',
    contentHash: 'abc123',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockOs.homedir.mockReturnValue('/home/testuser');

  // Default: fg returns empty array (no files found)
  mockFg.mockResolvedValue([]);

  // Default: existsSync returns false
  mockFs.existsSync.mockReturnValue(false);

  // Default: parseSkillFile returns a basic SkillFile
  mockParseSkillFile.mockReturnValue(makeSkillFile());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC1: Return shape
// ---------------------------------------------------------------------------

describe('scanAll — return shape', () => {
  it('returns a ScanResult with projects, userSkills, pluginSkills, and scannedAt', async () => {
    const result = await scanAll([]);

    expect(result).toHaveProperty('projects');
    expect(result).toHaveProperty('userSkills');
    expect(result).toHaveProperty('pluginSkills');
    expect(result).toHaveProperty('scannedAt');
  });

  it('scannedAt is an ISO 8601 string', async () => {
    const result = await scanAll([]);

    expect(result.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('returns empty arrays when no files exist', async () => {
    const result = await scanAll([]);

    expect(result.projects).toEqual([]);
    expect(result.userSkills).toEqual([]);
    expect(result.pluginSkills).toEqual([]);
  });

  it('passes through the input projects in output (with populated skills)', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];
    const result = await scanAll(projects);

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe('my-app');
  });
});

// ---------------------------------------------------------------------------
// AC2: Discovers files at all three levels
// ---------------------------------------------------------------------------

describe('scanAll — project-level scanning', () => {
  it('scans .claude/skills, .claude/agents, and .claude/rules under each project', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];

    mockFg.mockResolvedValue([]);

    await scanAll(projects);

    // fast-glob should have been called with patterns including the project path
    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const hasSkills = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('/repos/my-app') && p.includes('skills')
    );
    const hasAgents = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('/repos/my-app') && p.includes('agents')
    );
    const hasRules = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('/repos/my-app') && p.includes('rules')
    );

    expect(hasSkills).toBe(true);
    expect(hasAgents).toBe(true);
    expect(hasRules).toBe(true);
  });

  it('populates project.skills with parsed SkillFiles', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];
    const skillFile = makeSkillFile({
      filePath: '/repos/my-app/.claude/skills/cool-skill/SKILL.md',
      level: 'project',
      projectName: 'my-app',
      projectPath: '/repos/my-app',
    });

    // Return one file from fg for the project scan
    mockFg.mockResolvedValueOnce(['/repos/my-app/.claude/skills/cool-skill/SKILL.md']);
    // All subsequent calls return empty
    mockFg.mockResolvedValue([]);

    mockParseSkillFile.mockReturnValue(skillFile);

    const result = await scanAll(projects);

    expect(result.projects[0].skills).toHaveLength(1);
    expect(result.projects[0].skills[0].level).toBe('project');
    expect(result.projects[0].skills[0].projectName).toBe('my-app');
  });

  it('calls parseSkillFile with level=project and correct projectName', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];

    mockFg.mockResolvedValueOnce(['/repos/my-app/.claude/skills/cool-skill/SKILL.md']);
    mockFg.mockResolvedValue([]);

    await scanAll(projects);

    expect(mockParseSkillFile).toHaveBeenCalledWith(
      '/repos/my-app/.claude/skills/cool-skill/SKILL.md',
      'project',
      'my-app',
      '/repos/my-app'
    );
  });
});

describe('scanAll — user-level scanning', () => {
  it('scans ~/.claude/skills, ~/.claude/agents, ~/.claude/rules', async () => {
    await scanAll([]);

    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const homeDir = '/home/testuser';
    const hasUserSkills = allPatterns.some(
      (p) => typeof p === 'string' && p.includes(homeDir) && p.includes('skills')
    );
    const hasUserAgents = allPatterns.some(
      (p) => typeof p === 'string' && p.includes(homeDir) && p.includes('agents')
    );

    expect(hasUserSkills).toBe(true);
    expect(hasUserAgents).toBe(true);
  });

  it('populates userSkills with parsed SkillFiles at level=user', async () => {
    const skillFile = makeSkillFile({
      filePath: '/home/testuser/.claude/skills/my-skill/SKILL.md',
      level: 'user',
    });

    // First call: user scan returns a file
    mockFg.mockResolvedValueOnce(['/home/testuser/.claude/skills/my-skill/SKILL.md']);
    mockFg.mockResolvedValue([]);

    mockParseSkillFile.mockReturnValue(skillFile);

    const result = await scanAll([]);

    expect(result.userSkills).toHaveLength(1);
    expect(result.userSkills[0].level).toBe('user');
  });

  it('calls parseSkillFile with level=user and null projectName', async () => {
    mockFg.mockResolvedValueOnce(['/home/testuser/.claude/skills/my-skill/SKILL.md']);
    mockFg.mockResolvedValue([]);

    await scanAll([]);

    expect(mockParseSkillFile).toHaveBeenCalledWith(
      '/home/testuser/.claude/skills/my-skill/SKILL.md',
      'user',
      null,
      null
    );
  });
});

describe('scanAll — plugin-level scanning', () => {
  it('scans ~/.claude/plugins/ directory', async () => {
    // Simulate plugin directory existing with a subdirectory
    mockFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readdirSync.mockReturnValue([{ name: 'my-plugin', isDirectory: () => true }] as any);

    mockFg.mockResolvedValue([]);

    await scanAll([]);

    // Should have attempted to scan the plugin directory
    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const hasPlugins = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('plugins')
    );

    expect(hasPlugins).toBe(true);
  });

  it('populates pluginSkills with parsed SkillFiles at level=plugin', async () => {
    mockFs.existsSync.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFs.readdirSync.mockReturnValue([{ name: 'my-plugin', isDirectory: () => true }] as any);

    const pluginFile = makeSkillFile({
      filePath: '/home/testuser/.claude/plugins/my-plugin/SKILL.md',
      level: 'plugin',
    });

    // Return the plugin file only when the pattern includes "plugins", empty otherwise
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('plugins'))) {
        return ['/home/testuser/.claude/plugins/my-plugin/SKILL.md'];
      }
      return [];
    });

    mockParseSkillFile.mockReturnValue(pluginFile);

    const result = await scanAll([]);

    expect(result.pluginSkills).toHaveLength(1);
    expect(result.pluginSkills[0].level).toBe('plugin');
  });

  it('skips plugin scanning when ~/.claude/plugins does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFg.mockResolvedValue([]);

    await scanAll([]);

    // No error should be thrown
    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const hasPlugins = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('plugins')
    );

    expect(hasPlugins).toBe(false);
  });
});

describe('scanAll — additionalPaths', () => {
  it('accepts optional additionalPaths and scans them as project-level', async () => {
    mockFg.mockResolvedValue([]);

    await scanAll([], ['/extra/path']);

    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const hasExtra = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('/extra/path')
    );

    expect(hasExtra).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: Graceful handling of inaccessible directories
// ---------------------------------------------------------------------------

describe('scanAll — graceful error handling', () => {
  it('does not crash when fg throws for a project directory', async () => {
    const projects = [makeProject('bad-project', '/repos/bad-project')];

    mockFg.mockRejectedValueOnce(new Error('EACCES: permission denied'));
    mockFg.mockResolvedValue([]);

    // Should not throw
    await expect(scanAll(projects)).resolves.toBeDefined();
  });

  it('does not crash when parseSkillFile throws for a file', async () => {
    const projects = [makeProject('my-app', '/repos/my-app')];

    mockFg.mockResolvedValueOnce(['/repos/my-app/.claude/skills/bad-skill/SKILL.md']);
    mockFg.mockResolvedValue([]);

    mockParseSkillFile.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    await expect(scanAll(projects)).resolves.toBeDefined();
  });

  it('continues scanning other projects when one fails', async () => {
    const projects = [
      makeProject('bad-project', '/repos/bad-project'),
      makeProject('good-project', '/repos/good-project'),
    ];

    // bad-project patterns throw, good-project patterns return a file
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('bad-project'))) {
        throw new Error('EACCES');
      }
      if (patternList.some((p) => p.includes('good-project'))) {
        return ['/repos/good-project/.claude/skills/skill.md'];
      }
      return [];
    });

    mockParseSkillFile.mockReturnValue(makeSkillFile({ level: 'project', projectName: 'good-project' }));

    const result = await scanAll(projects);

    expect(result.projects).toHaveLength(2);
    expect(result.projects[1].skills).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC4: Logs scan stats
// ---------------------------------------------------------------------------

describe('scanAll — scan stats logging', () => {
  it('logs scan stats to console after scanning', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const skillFile = makeSkillFile({ type: 'skill', level: 'user' });
    mockFg.mockResolvedValueOnce(['/home/testuser/.claude/skills/skill-a/SKILL.md']);
    mockFg.mockResolvedValue([]);
    mockParseSkillFile.mockReturnValue(skillFile);

    await scanAll([]);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('skill')
    );

    consoleSpy.mockRestore();
  });
});
