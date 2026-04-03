/**
 * Unit tests for overlap cluster filtering and sorting utilities.
 *
 * AC1: Search box filters clusters by name in real-time → unit (pure logic)
 * AC2: Default sort prioritizes project/user clusters over plugin clusters → unit (pure logic)
 * AC3: "View diff" hidden on identical clusters → unit (pure logic)
 * AC4: Level filter to exclude plugin clusters → unit (pure logic)
 */

import { describe, it, expect } from 'vitest';
import {
  filterClustersBySearch,
  filterClustersByLevel,
  sortClusters,
  shouldShowDiff,
} from './overlaps-filter';
import type { OverlapCluster, SkillFile } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function makeSkillFile(overrides: Partial<SkillFile> & { filePath: string }): SkillFile {
  _idCounter += 1;
  return {
    name: `Skill ${_idCounter}`,
    description: '',
    type: 'skill',
    level: 'project',
    projectName: `project-${_idCounter}`,
    projectPath: `/repos/project-${_idCounter}`,
    pluginName: null,
    frontmatter: {},
    body: 'body',
    contentHash: `hash-${_idCounter}`,
    ...overrides,
  };
}

function makeCluster(
  skillIdentity: string,
  files: SkillFile[],
  status: 'identical' | 'drifted' = 'drifted'
): OverlapCluster {
  const hashGroups: Record<string, SkillFile[]> = {};
  for (const f of files) {
    if (!hashGroups[f.contentHash]) hashGroups[f.contentHash] = [];
    hashGroups[f.contentHash].push(f);
  }
  return {
    skillIdentity,
    filename: skillIdentity.includes('/') ? skillIdentity.split('/').pop()! : skillIdentity,
    files,
    status,
    hashGroups,
  };
}

// ---------------------------------------------------------------------------
// AC1: filterClustersBySearch — filters by skillIdentity name
// ---------------------------------------------------------------------------

describe('filterClustersBySearch', () => {
  const clusters = [
    makeCluster('code-review/SKILL.md', [
      makeSkillFile({ filePath: '/p1/.claude/skills/code-review/SKILL.md' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/code-review/SKILL.md' }),
    ]),
    makeCluster('deploy/RULE.md', [
      makeSkillFile({ filePath: '/p1/.claude/rules/deploy/RULE.md' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/deploy/RULE.md' }),
    ]),
    makeCluster('save/SKILL.md', [
      makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/SKILL.md' }),
    ]),
  ];

  it('returns all clusters when search is empty', () => {
    expect(filterClustersBySearch(clusters, '')).toHaveLength(3);
  });

  it('returns all clusters when search is whitespace', () => {
    expect(filterClustersBySearch(clusters, '   ')).toHaveLength(3);
  });

  it('filters by partial match on skillIdentity', () => {
    const result = filterClustersBySearch(clusters, 'code');
    expect(result).toHaveLength(1);
    expect(result[0].skillIdentity).toBe('code-review/SKILL.md');
  });

  it('is case-insensitive', () => {
    const result = filterClustersBySearch(clusters, 'DEPLOY');
    expect(result).toHaveLength(1);
    expect(result[0].skillIdentity).toBe('deploy/RULE.md');
  });

  it('matches the filename portion of skillIdentity', () => {
    const result = filterClustersBySearch(clusters, 'SKILL.md');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no clusters match', () => {
    expect(filterClustersBySearch(clusters, 'zzz-nomatch')).toHaveLength(0);
  });

  it('trims whitespace from search query', () => {
    const result = filterClustersBySearch(clusters, '  save  ');
    expect(result).toHaveLength(1);
    expect(result[0].skillIdentity).toBe('save/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// AC4: filterClustersByLevel — excludes plugin-only clusters
// ---------------------------------------------------------------------------

describe('filterClustersByLevel', () => {
  const projectCluster = makeCluster('code-review/SKILL.md', [
    makeSkillFile({ filePath: '/p1/.claude/skills/code-review/SKILL.md', level: 'project' }),
    makeSkillFile({ filePath: '/p2/.claude/skills/code-review/SKILL.md', level: 'project' }),
  ]);

  const pluginOnlyCluster = makeCluster('plugin-skill/SKILL.md', [
    makeSkillFile({ filePath: '/plugins/my-plugin/SKILL.md', level: 'plugin', pluginName: 'my-plugin' }),
    makeSkillFile({ filePath: '/plugins/other-plugin/SKILL.md', level: 'plugin', pluginName: 'other-plugin' }),
  ]);

  const mixedCluster = makeCluster('shared/SKILL.md', [
    makeSkillFile({ filePath: '/p1/.claude/skills/shared/SKILL.md', level: 'project' }),
    makeSkillFile({ filePath: '/plugins/my-plugin/shared/SKILL.md', level: 'plugin', pluginName: 'my-plugin' }),
  ]);

  it('returns all clusters when level is "all"', () => {
    const result = filterClustersByLevel([projectCluster, pluginOnlyCluster, mixedCluster], 'all');
    expect(result).toHaveLength(3);
  });

  it('excludes clusters where ALL files are plugins when level is "no-plugins"', () => {
    const result = filterClustersByLevel([projectCluster, pluginOnlyCluster, mixedCluster], 'no-plugins');
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.skillIdentity)).not.toContain('plugin-skill/SKILL.md');
  });

  it('keeps mixed clusters (project + plugin) when level is "no-plugins"', () => {
    const result = filterClustersByLevel([projectCluster, pluginOnlyCluster, mixedCluster], 'no-plugins');
    expect(result.map((c) => c.skillIdentity)).toContain('shared/SKILL.md');
  });

  it('keeps project-only clusters when level is "no-plugins"', () => {
    const result = filterClustersByLevel([projectCluster, pluginOnlyCluster, mixedCluster], 'no-plugins');
    expect(result.map((c) => c.skillIdentity)).toContain('code-review/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// AC2: sortClusters — project/user clusters prioritized over plugin clusters
// ---------------------------------------------------------------------------

describe('sortClusters', () => {
  const projectCluster = makeCluster('code-review/SKILL.md', [
    makeSkillFile({ filePath: '/p1/.claude/skills/code-review/SKILL.md', level: 'project' }),
    makeSkillFile({ filePath: '/p2/.claude/skills/code-review/SKILL.md', level: 'project' }),
  ]);

  const userCluster = makeCluster('save/SKILL.md', [
    makeSkillFile({ filePath: '/home/.claude/skills/save/SKILL.md', level: 'user' }),
    makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', level: 'project' }),
  ]);

  const pluginOnlyCluster = makeCluster('plugin-skill/SKILL.md', [
    makeSkillFile({ filePath: '/plugins/my-plugin/SKILL.md', level: 'plugin', pluginName: 'my-plugin' }),
    makeSkillFile({ filePath: '/plugins/other/SKILL.md', level: 'plugin', pluginName: 'other' }),
  ]);

  it('puts non-plugin clusters before plugin-only clusters', () => {
    const sorted = sortClusters([pluginOnlyCluster, projectCluster, userCluster]);
    expect(sorted[sorted.length - 1].skillIdentity).toBe('plugin-skill/SKILL.md');
    expect(sorted[0].skillIdentity).not.toBe('plugin-skill/SKILL.md');
    expect(sorted[1].skillIdentity).not.toBe('plugin-skill/SKILL.md');
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [pluginOnlyCluster, projectCluster];
    const result = sortClusters(input);
    expect(result).not.toBe(input);
  });

  it('keeps relative order of same-priority clusters stable', () => {
    const sorted = sortClusters([projectCluster, userCluster, pluginOnlyCluster]);
    // Project and user clusters should appear before plugin-only cluster
    const pluginIdx = sorted.findIndex((c) => c.skillIdentity === 'plugin-skill/SKILL.md');
    const projectIdx = sorted.findIndex((c) => c.skillIdentity === 'code-review/SKILL.md');
    const userIdx = sorted.findIndex((c) => c.skillIdentity === 'save/SKILL.md');
    expect(projectIdx).toBeLessThan(pluginIdx);
    expect(userIdx).toBeLessThan(pluginIdx);
  });

  it('returns empty array for empty input', () => {
    expect(sortClusters([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC3: shouldShowDiff — hidden/replaced on identical clusters
// ---------------------------------------------------------------------------

describe('shouldShowDiff', () => {
  it('returns true for drifted clusters', () => {
    const driftedCluster = makeCluster(
      'deploy/SKILL.md',
      [
        makeSkillFile({ filePath: '/p1/.claude/skills/deploy/SKILL.md', contentHash: 'hash-a' }),
        makeSkillFile({ filePath: '/p2/.claude/skills/deploy/SKILL.md', contentHash: 'hash-b' }),
      ],
      'drifted'
    );
    expect(shouldShowDiff(driftedCluster)).toBe(true);
  });

  it('returns false for identical clusters', () => {
    const identicalCluster = makeCluster(
      'save/SKILL.md',
      [
        makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', contentHash: 'same-hash' }),
        makeSkillFile({ filePath: '/p2/.claude/skills/save/SKILL.md', contentHash: 'same-hash' }),
      ],
      'identical'
    );
    expect(shouldShowDiff(identicalCluster)).toBe(false);
  });
});
