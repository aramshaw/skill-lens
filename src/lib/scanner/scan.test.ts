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
    pluginName: null,
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
      '/repos/my-app',
      null
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
      null,
      null
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers for installed_plugins.json mocking
// ---------------------------------------------------------------------------

/**
 * Build the JSON string for installed_plugins.json with the given plugin entries.
 * Each entry is { key: string, installPath: string }.
 */
function makeInstalledPluginsJson(
  plugins: Array<{ key: string; installPath: string }>,
  version = 2
): string {
  const pluginsObj: Record<string, Array<{ scope: string; installPath: string }>> = {};
  for (const { key, installPath } of plugins) {
    pluginsObj[key] = [{ scope: 'user', installPath }];
  }
  return JSON.stringify({ version, plugins: pluginsObj });
}

// ---------------------------------------------------------------------------
// AC1-AC5: Plugin-level scanning via installed_plugins.json
// ---------------------------------------------------------------------------

describe('scanAll — plugin-level scanning (installed_plugins.json)', () => {
  // AC1: reads installed_plugins.json
  it('reads installed_plugins.json to determine which plugins to scan', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/official/vercel/abc123';
    const jsonContent = makeInstalledPluginsJson([
      { key: 'vercel@claude-plugins-official', installPath },
    ]);

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockResolvedValue([]);

    await scanAll([]);

    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    // The installPath should appear in glob patterns
    const hasInstallPath = allPatterns.some(
      (p) => typeof p === 'string' && p.includes('abc123')
    );
    expect(hasInstallPath).toBe(true);
  });

  // AC2: only installed directories are scanned
  it('does not glob the entire plugins directory — only installPath dirs', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/official/vercel/abc123';
    const jsonContent = makeInstalledPluginsJson([
      { key: 'vercel@claude-plugins-official', installPath },
    ]);

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockResolvedValue([]);

    await scanAll([]);

    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    // Should NOT glob a wildcard over the top-level plugins dir
    const hasBroadPluginGlob = allPatterns.some(
      (p) =>
        typeof p === 'string' &&
        p.includes('plugins') &&
        !p.includes('abc123') &&
        !p.includes('installed_plugins')
    );
    expect(hasBroadPluginGlob).toBe(false);
  });

  // AC3: plugin name derived from JSON key (the part before @)
  it('derives plugin name from the JSON key (e.g. "vercel" from "vercel@claude-plugins-official")', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/official/vercel/abc123';
    const jsonContent = makeInstalledPluginsJson([
      { key: 'vercel@claude-plugins-official', installPath },
    ]);

    const pluginFile = makeSkillFile({
      filePath: `${installPath}/SKILL.md`,
      level: 'plugin',
      pluginName: 'vercel',
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('abc123'))) {
        return [`${installPath}/SKILL.md`];
      }
      return [];
    });
    mockParseSkillFile.mockReturnValue(pluginFile);

    await scanAll([]);

    expect(mockParseSkillFile).toHaveBeenCalledWith(
      `${installPath}/SKILL.md`,
      'plugin',
      null,
      null,
      'vercel'
    );
  });

  it('uses key name as-is when there is no @ separator', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/myplugin/v1';
    const jsonContent = JSON.stringify({
      version: 2,
      plugins: {
        myplugin: [{ scope: 'user', installPath }],
      },
    });

    const pluginFile = makeSkillFile({
      filePath: `${installPath}/SKILL.md`,
      level: 'plugin',
      pluginName: 'myplugin',
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('v1'))) {
        return [`${installPath}/SKILL.md`];
      }
      return [];
    });
    mockParseSkillFile.mockReturnValue(pluginFile);

    await scanAll([]);

    expect(mockParseSkillFile).toHaveBeenCalledWith(
      `${installPath}/SKILL.md`,
      'plugin',
      null,
      null,
      'myplugin'
    );
  });

  it('populates pluginSkills with parsed SkillFiles at level=plugin', async () => {
    const installPath = '/home/testuser/.claude/plugins/cache/official/my-plugin/abc';
    const jsonContent = makeInstalledPluginsJson([
      { key: 'my-plugin@official', installPath },
    ]);

    const pluginFile = makeSkillFile({
      filePath: `${installPath}/SKILL.md`,
      level: 'plugin',
      pluginName: 'my-plugin',
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('abc'))) {
        return [`${installPath}/SKILL.md`];
      }
      return [];
    });
    mockParseSkillFile.mockReturnValue(pluginFile);

    const result = await scanAll([]);

    expect(result.pluginSkills).toHaveLength(1);
    expect(result.pluginSkills[0].level).toBe('plugin');
    expect(result.pluginSkills[0].pluginName).toBe('my-plugin');
  });

  // AC4: graceful fallback when installed_plugins.json is missing
  it('returns empty pluginSkills when installed_plugins.json does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // AC4: graceful fallback when installed_plugins.json is malformed JSON
  it('returns empty pluginSkills when installed_plugins.json contains malformed JSON', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{ this is not valid json !!!');
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // AC4: graceful fallback when installed_plugins.json has unexpected structure
  it('returns empty pluginSkills when installed_plugins.json has no plugins field', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: 2 }));
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // AC4: graceful fallback when installed_plugins.json plugins field is not an object
  it('returns empty pluginSkills when plugins field is not an object', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: 2, plugins: [] }));
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // AC4: graceful fallback when readFileSync throws
  it('returns empty pluginSkills when readFileSync throws', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // AC4: empty plugins list in JSON → scan nothing
  it('returns empty pluginSkills when installed_plugins.json has empty plugins object', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: 2, plugins: {} }));
    mockFg.mockResolvedValue([]);

    const result = await scanAll([]);

    expect(result.pluginSkills).toEqual([]);
  });

  // Multiple plugins: each gets its own installPath scanned
  it('scans all installPath entries from installed_plugins.json', async () => {
    const installPath1 = '/home/testuser/.claude/plugins/cache/official/vercel/abc';
    const installPath2 = '/home/testuser/.claude/plugins/cache/official/feature-dev/xyz';
    const jsonContent = makeInstalledPluginsJson([
      { key: 'vercel@claude-plugins-official', installPath: installPath1 },
      { key: 'feature-dev@claude-plugins-official', installPath: installPath2 },
    ]);

    const vercelFile = makeSkillFile({
      filePath: `${installPath1}/SKILL.md`,
      level: 'plugin',
      pluginName: 'vercel',
    });
    const featureDevFile = makeSkillFile({
      filePath: `${installPath2}/SKILL.md`,
      level: 'plugin',
      pluginName: 'feature-dev',
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      if (patternList.some((p) => p.includes('abc'))) return [`${installPath1}/SKILL.md`];
      if (patternList.some((p) => p.includes('xyz'))) return [`${installPath2}/SKILL.md`];
      return [];
    });
    mockParseSkillFile.mockImplementation((_fp, _level, _pn, _pp, pluginName) => {
      if (pluginName === 'vercel') return vercelFile;
      return featureDevFile;
    });

    const result = await scanAll([]);

    expect(result.pluginSkills).toHaveLength(2);
    const names = result.pluginSkills.map((s) => s.pluginName).sort();
    expect(names).toEqual(['feature-dev', 'vercel']);
  });

  // A plugin entry with multiple installPaths (array length > 1) — scan all
  it('scans multiple installPaths for a single plugin key', async () => {
    const installPath1 = '/home/testuser/.claude/plugins/cache/official/vercel/abc';
    const installPath2 = '/home/testuser/.claude/plugins/cache/official/vercel/def';
    const jsonContent = JSON.stringify({
      version: 2,
      plugins: {
        'vercel@official': [
          { scope: 'user', installPath: installPath1 },
          { scope: 'project', installPath: installPath2 },
        ],
      },
    });

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(jsonContent);
    mockFg.mockResolvedValue([]);

    await scanAll([]);

    const calls = mockFg.mock.calls;
    const allPatterns = calls.flatMap(([patterns]) =>
      Array.isArray(patterns) ? patterns : [patterns]
    );

    const hasAbc = allPatterns.some((p) => typeof p === 'string' && p.includes('abc'));
    const hasDef = allPatterns.some((p) => typeof p === 'string' && p.includes('def'));
    expect(hasAbc).toBe(true);
    expect(hasDef).toBe(true);
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
// AC5: Deduplication — same filePath from multiple sources
// ---------------------------------------------------------------------------

describe('deduplicateSkills — filePath deduplication', () => {
  it('removes duplicate entries with the same filePath', async () => {
    const { deduplicateSkills } = await import('./scan');

    const file1 = makeSkillFile({
      filePath: '/home/testuser/.claude/skills/my-skill/SKILL.md',
      level: 'user',
      projectName: null,
    });
    const file2 = makeSkillFile({
      filePath: '/home/testuser/.claude/skills/my-skill/SKILL.md',
      level: 'project',
      projectName: 'testuser',
    });

    const result = deduplicateSkills([file1, file2]);
    expect(result).toHaveLength(1);
  });

  it('prefers user-level over project-level for the same filePath', async () => {
    const { deduplicateSkills } = await import('./scan');

    const userFile = makeSkillFile({
      filePath: '/home/testuser/.claude/skills/my-skill/SKILL.md',
      level: 'user',
      projectName: null,
    });
    const projectFile = makeSkillFile({
      filePath: '/home/testuser/.claude/skills/my-skill/SKILL.md',
      level: 'project',
      projectName: 'testuser',
    });

    // user appears second — still wins
    const result = deduplicateSkills([projectFile, userFile]);
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('user');
  });

  it('prefers plugin-level over project-level for the same filePath', async () => {
    const { deduplicateSkills } = await import('./scan');

    const pluginFile = makeSkillFile({
      filePath: '/home/testuser/.claude/plugins/my-plugin/SKILL.md',
      level: 'plugin',
      projectName: null,
    });
    const projectFile = makeSkillFile({
      filePath: '/home/testuser/.claude/plugins/my-plugin/SKILL.md',
      level: 'project',
      projectName: 'testuser',
    });

    const result = deduplicateSkills([projectFile, pluginFile]);
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('plugin');
  });

  it('keeps all entries when filePaths are distinct', async () => {
    const { deduplicateSkills } = await import('./scan');

    const a = makeSkillFile({ filePath: '/repos/a/.claude/skills/a.md', level: 'project' });
    const b = makeSkillFile({ filePath: '/repos/b/.claude/skills/b.md', level: 'project' });
    const c = makeSkillFile({ filePath: '/home/testuser/.claude/skills/c.md', level: 'user' });

    const result = deduplicateSkills([a, b, c]);
    expect(result).toHaveLength(3);
  });

  it('handles empty input', async () => {
    const { deduplicateSkills } = await import('./scan');
    expect(deduplicateSkills([])).toEqual([]);
  });
});

describe('scanAll — home directory as project deduplication', () => {
  it('does not include user-level files as project-level when home dir is a project', async () => {
    // Simulate: home dir (/home/testuser) listed as a project AND user-level scan
    // Both find the same file at /home/testuser/.claude/skills/my-skill/SKILL.md
    const homeProject = makeProject('testuser', '/home/testuser');
    const sharedPath = '/home/testuser/.claude/skills/my-skill/SKILL.md';

    const userFile = makeSkillFile({ filePath: sharedPath, level: 'user', projectName: null });
    const projectFile = makeSkillFile({ filePath: sharedPath, level: 'project', projectName: 'testuser' });

    mockFg.mockImplementation(async (patterns: string | string[]) => {
      const patternList = Array.isArray(patterns) ? patterns : [patterns];
      // Both project scan and user-level scan return the same file
      if (patternList.some((p) => p.includes('/home/testuser'))) {
        return [sharedPath];
      }
      return [];
    });

    mockParseSkillFile.mockImplementation(
      (_filePath: string, level: SkillFile['level']) => {
        if (level === 'user') return userFile;
        return projectFile;
      }
    );

    mockFs.existsSync.mockReturnValue(false); // no plugins

    const result = await scanAll([homeProject]);

    // The same physical file should appear only once across all arrays
    const projectSkillPaths = result.projects.flatMap((p) => p.skills.map((s) => s.filePath));
    const userSkillPaths = result.userSkills.map((s) => s.filePath);
    const allPaths = [...projectSkillPaths, ...userSkillPaths];

    const uniquePaths = new Set(allPaths);
    expect(uniquePaths.size).toBe(allPaths.length);
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
