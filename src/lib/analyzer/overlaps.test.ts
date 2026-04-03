/**
 * Unit tests for buildOverlapClusters()
 *
 * AC1: Correctly clusters exact duplicates
 * AC2: Correctly identifies drifted copies
 * AC3: Ignores singletons (skills that exist in only one location)
 * AC4: Unit tests with mock data
 */

import { describe, it, expect } from 'vitest';
import { buildOverlapClusters } from './overlaps';
import type { SkillFile } from '@/lib/types';

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

// ---------------------------------------------------------------------------
// AC3: Singletons are excluded
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — singletons', () => {
  it('returns empty array when there is only one file', () => {
    const files = [makeSkillFile({ filePath: '/project-a/.claude/skills/save/SKILL.md' })];
    expect(buildOverlapClusters(files)).toEqual([]);
  });

  it('returns empty array when all files have unique filenames', () => {
    const files = [
      makeSkillFile({ filePath: '/project-a/.claude/rules/save.md' }),
      makeSkillFile({ filePath: '/project-b/.claude/rules/commit.md' }),
      makeSkillFile({ filePath: '/project-c/.claude/rules/deploy.md' }),
    ];
    expect(buildOverlapClusters(files)).toEqual([]);
  });

  it('returns empty array for an empty input', () => {
    expect(buildOverlapClusters([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC1: Exact duplicates — same filename AND same content hash
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — identical (exact duplicates)', () => {
  it('produces one cluster for two files with the same filename and hash', () => {
    const sharedHash = 'aaaa1111';
    const files = [
      makeSkillFile({
        filePath: '/project-a/.claude/skills/save/SKILL.md',
        contentHash: sharedHash,
      }),
      makeSkillFile({
        filePath: '/project-b/.claude/skills/save/SKILL.md',
        contentHash: sharedHash,
      }),
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].filename).toBe('SKILL.md');
    expect(clusters[0].status).toBe('identical');
    expect(clusters[0].files).toHaveLength(2);
  });

  it('groups all files into a single hashGroup entry when all hashes match', () => {
    const sharedHash = 'bbbb2222';
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/style.md', contentHash: sharedHash }),
      makeSkillFile({ filePath: '/p2/.claude/rules/style.md', contentHash: sharedHash }),
      makeSkillFile({ filePath: '/p3/.claude/rules/style.md', contentHash: sharedHash }),
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].status).toBe('identical');

    const hashKeys = Object.keys(clusters[0].hashGroups);
    expect(hashKeys).toHaveLength(1);
    expect(hashKeys[0]).toBe(sharedHash);
    expect(clusters[0].hashGroups[sharedHash]).toHaveLength(3);
  });

  it('sets filename to the basename of the matched files', () => {
    const sharedHash = 'cccc3333';
    const files = [
      makeSkillFile({ filePath: '/home/user/.claude/agents/my-agent/AGENT.md', contentHash: sharedHash }),
      makeSkillFile({ filePath: '/project-x/.claude/agents/my-agent/AGENT.md', contentHash: sharedHash }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters[0].filename).toBe('AGENT.md');
  });
});

// ---------------------------------------------------------------------------
// AC2: Drifted — same filename BUT different content hashes
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — drifted', () => {
  it('marks a cluster as drifted when two files share a filename but differ in hash', () => {
    const files = [
      makeSkillFile({ filePath: '/project-a/.claude/skills/save/SKILL.md', contentHash: 'hash-aaa' }),
      makeSkillFile({ filePath: '/project-b/.claude/skills/save/SKILL.md', contentHash: 'hash-bbb' }),
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].status).toBe('drifted');
  });

  it('creates one hashGroup per distinct hash when drifted', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/lint.md', contentHash: 'hash-x' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/lint.md', contentHash: 'hash-y' }),
      makeSkillFile({ filePath: '/p3/.claude/rules/lint.md', contentHash: 'hash-x' }), // same as p1
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].status).toBe('drifted');

    const hashKeys = Object.keys(clusters[0].hashGroups);
    expect(hashKeys).toHaveLength(2); // two distinct hashes

    expect(clusters[0].hashGroups['hash-x']).toHaveLength(2);
    expect(clusters[0].hashGroups['hash-y']).toHaveLength(1);
  });

  it('includes all files in the cluster regardless of which hash they belong to', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/deploy/SKILL.md', contentHash: 'hash-1' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/deploy/SKILL.md', contentHash: 'hash-2' }),
      makeSkillFile({ filePath: '/p3/.claude/skills/deploy/SKILL.md', contentHash: 'hash-3' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters[0].files).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Multiple clusters in a single call
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — multiple clusters', () => {
  it('returns separate clusters for each overlapping filename', () => {
    const files = [
      // "SKILL.md" group (identical)
      makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', contentHash: 'same' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/SKILL.md', contentHash: 'same' }),
      // "lint.md" group (drifted)
      makeSkillFile({ filePath: '/p1/.claude/rules/lint.md', contentHash: 'v1' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/lint.md', contentHash: 'v2' }),
      // "unique.md" singleton — should be excluded
      makeSkillFile({ filePath: '/p1/.claude/skills/unique/unique.md' }),
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(2);

    const skillCluster = clusters.find((c) => c.filename === 'SKILL.md');
    const lintCluster = clusters.find((c) => c.filename === 'lint.md');

    expect(skillCluster).toBeDefined();
    expect(skillCluster!.status).toBe('identical');

    expect(lintCluster).toBeDefined();
    expect(lintCluster!.status).toBe('drifted');
  });

  it('does not include singletons when some filenames are shared and others are not', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/p1/.claude/skills/only-here.md' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].filename).toBe('SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// hashGroups structure
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — hashGroups structure', () => {
  it('hashGroups keys are the content hash strings', () => {
    const hash = 'deadbeef';
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/check.md', contentHash: hash }),
      makeSkillFile({ filePath: '/p2/.claude/rules/check.md', contentHash: hash }),
    ];

    const clusters = buildOverlapClusters(files);
    const keys = Object.keys(clusters[0].hashGroups);
    expect(keys).toEqual([hash]);
  });

  it('hashGroups values are arrays of SkillFile', () => {
    const hash = 'cafebabe';
    const fileA = makeSkillFile({ filePath: '/p1/.claude/rules/check.md', contentHash: hash });
    const fileB = makeSkillFile({ filePath: '/p2/.claude/rules/check.md', contentHash: hash });

    const clusters = buildOverlapClusters([fileA, fileB]);
    const group = clusters[0].hashGroups[hash];

    expect(group).toContainEqual(fileA);
    expect(group).toContainEqual(fileB);
  });

  it('is JSON-serializable (no Map or Set values)', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/style.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/style.md', contentHash: 'h2' }),
    ];

    const clusters = buildOverlapClusters(files);

    // Should not throw
    expect(() => JSON.stringify(clusters)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — edge cases', () => {
  it('treats filenames as case-sensitive (SKILL.md and skill.md are different)', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', contentHash: 'h' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/skill.md', contentHash: 'h' }),
    ];

    // Different basenames → no cluster
    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(0);
  });

  it('uses only the basename for grouping, ignoring directory path', () => {
    const hash = 'same-hash';
    const files = [
      makeSkillFile({
        filePath: '/home/user/.claude/skills/save/SKILL.md',
        contentHash: hash,
        level: 'user',
      }),
      makeSkillFile({
        filePath: '/repos/project-a/.claude/skills/different-name/SKILL.md',
        contentHash: hash,
        level: 'project',
      }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].filename).toBe('SKILL.md');
  });

  it('handles a large number of files efficiently', () => {
    const files: SkillFile[] = [];
    for (let i = 0; i < 500; i++) {
      files.push(
        makeSkillFile({
          filePath: `/project-${i}/.claude/skills/common/SKILL.md`,
          contentHash: i % 2 === 0 ? 'even-hash' : 'odd-hash',
        })
      );
    }

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].status).toBe('drifted');
    expect(clusters[0].files).toHaveLength(500);
  });
});
