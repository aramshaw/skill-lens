/**
 * Unit tests for buildOverlapClusters()
 *
 * AC1: Skills clustered by identity (parent dir / filename), not raw filename
 * AC2: SKILL.md, RULE.md, README.md no longer create single mega-clusters
 * AC3: Singletons (skills with a unique identity) are excluded
 * AC4: Drifted vs identical status is computed correctly
 * AC5: hashGroups structure is correct and JSON-serializable
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
// AC1: Cluster by skill identity (parent dir + filename), NOT raw filename
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — identity-based clustering (AC1)', () => {
  it('separates SKILL.md files from different parent directories into distinct clusters', () => {
    const files = [
      // "code-review" skill in two projects
      makeSkillFile({
        filePath: '/repos/proj-a/.claude/skills/code-review/SKILL.md',
        contentHash: 'hash-cr',
      }),
      makeSkillFile({
        filePath: '/repos/proj-b/.claude/skills/code-review/SKILL.md',
        contentHash: 'hash-cr',
      }),
      // "deploy" skill in two projects — different identity, different cluster
      makeSkillFile({
        filePath: '/repos/proj-a/.claude/skills/deploy/SKILL.md',
        contentHash: 'hash-dep',
      }),
      makeSkillFile({
        filePath: '/repos/proj-b/.claude/skills/deploy/SKILL.md',
        contentHash: 'hash-dep',
      }),
    ];

    const clusters = buildOverlapClusters(files);

    // Must produce 2 clusters, not 1 mega-cluster
    expect(clusters).toHaveLength(2);

    const identities = clusters.map((c) => c.skillIdentity).sort();
    expect(identities).toEqual(['code-review/SKILL.md', 'deploy/SKILL.md']);
  });

  it('does NOT merge unrelated SKILL.md files into one cluster', () => {
    const files = [
      makeSkillFile({ filePath: '/proj-a/.claude/skills/save/SKILL.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/proj-b/.claude/skills/save/SKILL.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/proj-a/.claude/skills/commit/SKILL.md', contentHash: 'h2' }),
      makeSkillFile({ filePath: '/proj-b/.claude/skills/commit/SKILL.md', contentHash: 'h2' }),
      makeSkillFile({ filePath: '/proj-a/.claude/skills/lint/SKILL.md', contentHash: 'h3' }),
      makeSkillFile({ filePath: '/proj-b/.claude/skills/lint/SKILL.md', contentHash: 'h3' }),
    ];

    const clusters = buildOverlapClusters(files);

    // Three separate skill identities → three clusters
    expect(clusters).toHaveLength(3);
    const identities = clusters.map((c) => c.skillIdentity).sort();
    expect(identities).toEqual([
      'commit/SKILL.md',
      'lint/SKILL.md',
      'save/SKILL.md',
    ]);
  });

  it('does NOT cluster a single SKILL.md file that only appears in one project (singleton)', () => {
    const files = [
      // "code-review" in 2 projects → cluster
      makeSkillFile({ filePath: '/proj-a/.claude/skills/code-review/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/proj-b/.claude/skills/code-review/SKILL.md', contentHash: 'x' }),
      // "unique-thing" in 1 project → singleton, excluded
      makeSkillFile({ filePath: '/proj-a/.claude/skills/unique-thing/SKILL.md', contentHash: 'y' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].skillIdentity).toBe('code-review/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// AC2: Common filenames like SKILL.md / RULE.md / README.md no longer mega-cluster
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — no mega-clusters (AC2)', () => {
  it('RULE.md files with different parent dirs do not form a single mega-cluster', () => {
    const files = [
      makeSkillFile({ filePath: '/proj-a/.claude/rules/style/RULE.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/proj-b/.claude/rules/style/RULE.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/proj-a/.claude/rules/naming/RULE.md', contentHash: 'h2' }),
      makeSkillFile({ filePath: '/proj-b/.claude/rules/naming/RULE.md', contentHash: 'h2' }),
    ];

    const clusters = buildOverlapClusters(files);
    // Two clusters, each with 2 files — not one cluster with 4
    expect(clusters).toHaveLength(2);
    for (const c of clusters) {
      expect(c.files).toHaveLength(2);
    }
  });

  it('README.md files with different parent dirs do not mega-cluster', () => {
    const files = [
      makeSkillFile({ filePath: '/proj-a/.claude/agents/deploy-agent/README.md', contentHash: 'ra' }),
      makeSkillFile({ filePath: '/proj-b/.claude/agents/deploy-agent/README.md', contentHash: 'ra' }),
      makeSkillFile({ filePath: '/proj-a/.claude/agents/review-agent/README.md', contentHash: 'rb' }),
      makeSkillFile({ filePath: '/proj-b/.claude/agents/review-agent/README.md', contentHash: 'rb' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(2);

    const identities = clusters.map((c) => c.skillIdentity).sort();
    expect(identities).toEqual([
      'deploy-agent/README.md',
      'review-agent/README.md',
    ]);
  });

  it('500 different SKILL.md files (simulating real world) produce many small clusters, not one mega', () => {
    const files: SkillFile[] = [];
    // 50 distinct skill identities, each present in 2 projects
    for (let skill = 0; skill < 50; skill++) {
      for (let project = 0; project < 2; project++) {
        files.push(
          makeSkillFile({
            filePath: `/repos/proj-${project}/.claude/skills/skill-${skill}/SKILL.md`,
            contentHash: `hash-skill-${skill}`,
          })
        );
      }
    }

    const clusters = buildOverlapClusters(files);

    // 50 clusters, NOT 1 mega-cluster
    expect(clusters).toHaveLength(50);
    for (const c of clusters) {
      expect(c.files).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3: Singletons excluded
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — singletons (AC3)', () => {
  it('returns empty array when there is only one file', () => {
    const files = [makeSkillFile({ filePath: '/project-a/.claude/skills/save/SKILL.md' })];
    expect(buildOverlapClusters(files)).toEqual([]);
  });

  it('returns empty array when all files have unique identities', () => {
    const files = [
      makeSkillFile({ filePath: '/project-a/.claude/rules/save/save.md' }),
      makeSkillFile({ filePath: '/project-b/.claude/rules/commit/commit.md' }),
      makeSkillFile({ filePath: '/project-c/.claude/rules/deploy/deploy.md' }),
    ];
    expect(buildOverlapClusters(files)).toEqual([]);
  });

  it('returns empty array for an empty input', () => {
    expect(buildOverlapClusters([])).toEqual([]);
  });

  it('handles mix of singletons and clusters', () => {
    const files = [
      // cluster
      makeSkillFile({ filePath: '/p1/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      // singletons
      makeSkillFile({ filePath: '/p1/.claude/skills/only-here/SKILL.md' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/only-there/SKILL.md' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].skillIdentity).toBe('shared/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// AC4: Status — identical vs drifted
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — identical (AC4)', () => {
  it('produces one cluster for two files with the same identity and hash', () => {
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
    expect(clusters[0].skillIdentity).toBe('save/SKILL.md');
    expect(clusters[0].filename).toBe('SKILL.md');
    expect(clusters[0].status).toBe('identical');
    expect(clusters[0].files).toHaveLength(2);
  });

  it('groups all files into a single hashGroup entry when all hashes match', () => {
    const sharedHash = 'bbbb2222';
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/style/style.md', contentHash: sharedHash }),
      makeSkillFile({ filePath: '/p2/.claude/rules/style/style.md', contentHash: sharedHash }),
      makeSkillFile({ filePath: '/p3/.claude/rules/style/style.md', contentHash: sharedHash }),
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
    expect(clusters[0].skillIdentity).toBe('my-agent/AGENT.md');
  });
});

describe('buildOverlapClusters — drifted (AC4)', () => {
  it('marks a cluster as drifted when two files share an identity but differ in hash', () => {
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
      makeSkillFile({ filePath: '/p1/.claude/rules/lint/lint.md', contentHash: 'hash-x' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/lint/lint.md', contentHash: 'hash-y' }),
      makeSkillFile({ filePath: '/p3/.claude/rules/lint/lint.md', contentHash: 'hash-x' }), // same as p1
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
  it('returns separate clusters for each overlapping identity', () => {
    const files = [
      // "save/SKILL.md" group (identical)
      makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', contentHash: 'same' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/SKILL.md', contentHash: 'same' }),
      // "lint/lint.md" group (drifted)
      makeSkillFile({ filePath: '/p1/.claude/rules/lint/lint.md', contentHash: 'v1' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/lint/lint.md', contentHash: 'v2' }),
      // singleton — should be excluded
      makeSkillFile({ filePath: '/p1/.claude/skills/unique/unique.md' }),
    ];

    const clusters = buildOverlapClusters(files);

    expect(clusters).toHaveLength(2);

    const skillCluster = clusters.find((c) => c.skillIdentity === 'save/SKILL.md');
    const lintCluster = clusters.find((c) => c.skillIdentity === 'lint/lint.md');

    expect(skillCluster).toBeDefined();
    expect(skillCluster!.status).toBe('identical');

    expect(lintCluster).toBeDefined();
    expect(lintCluster!.status).toBe('drifted');
  });

  it('does not include singletons when some identities are shared and others are not', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/shared/SKILL.md', contentHash: 'x' }),
      makeSkillFile({ filePath: '/p1/.claude/skills/only-here/SKILL.md' }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].skillIdentity).toBe('shared/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// AC5: hashGroups structure
// ---------------------------------------------------------------------------

describe('buildOverlapClusters — hashGroups structure (AC5)', () => {
  it('hashGroups keys are the content hash strings', () => {
    const hash = 'deadbeef';
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/check/check.md', contentHash: hash }),
      makeSkillFile({ filePath: '/p2/.claude/rules/check/check.md', contentHash: hash }),
    ];

    const clusters = buildOverlapClusters(files);
    const keys = Object.keys(clusters[0].hashGroups);
    expect(keys).toEqual([hash]);
  });

  it('hashGroups values are arrays of SkillFile', () => {
    const hash = 'cafebabe';
    const fileA = makeSkillFile({ filePath: '/p1/.claude/rules/check/check.md', contentHash: hash });
    const fileB = makeSkillFile({ filePath: '/p2/.claude/rules/check/check.md', contentHash: hash });

    const clusters = buildOverlapClusters([fileA, fileB]);
    const group = clusters[0].hashGroups[hash];

    expect(group).toContainEqual(fileA);
    expect(group).toContainEqual(fileB);
  });

  it('is JSON-serializable (no Map or Set values)', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/rules/style/style.md', contentHash: 'h1' }),
      makeSkillFile({ filePath: '/p2/.claude/rules/style/style.md', contentHash: 'h2' }),
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
  it('treats identity as case-sensitive', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/save/SKILL.md', contentHash: 'h' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/skill.md', contentHash: 'h' }),
    ];

    // Different basenames (SKILL.md vs skill.md) → different identities → no cluster
    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(0);
  });

  it('treats parent directory name as case-sensitive', () => {
    const files = [
      makeSkillFile({ filePath: '/p1/.claude/skills/Save/SKILL.md', contentHash: 'h' }),
      makeSkillFile({ filePath: '/p2/.claude/skills/save/SKILL.md', contentHash: 'h' }),
    ];

    // Different parent dirs (Save vs save) → different identities → no cluster
    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(0);
  });

  it('uses parent dir + filename for identity, not full path', () => {
    const hash = 'same-hash';
    const files = [
      makeSkillFile({
        filePath: '/home/user/.claude/skills/save/SKILL.md',
        contentHash: hash,
        level: 'user',
      }),
      makeSkillFile({
        filePath: '/repos/project-a/.claude/skills/save/SKILL.md',
        contentHash: hash,
        level: 'project',
      }),
    ];

    const clusters = buildOverlapClusters(files);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].skillIdentity).toBe('save/SKILL.md');
    expect(clusters[0].filename).toBe('SKILL.md');
  });

  it('falls back to basename-only identity when file has no parent directory', () => {
    const files = [
      makeSkillFile({ filePath: 'SKILL.md', contentHash: 'h' }),
      makeSkillFile({ filePath: 'SKILL.md', contentHash: 'h' }),
    ];

    const clusters = buildOverlapClusters(files);
    // Both share the same path (or same basename when no parent) → cluster
    expect(clusters).toHaveLength(1);
  });

  it('handles a large number of files efficiently with many distinct identities', () => {
    const files: SkillFile[] = [];
    // 100 distinct skill identities, each in 5 projects
    for (let skill = 0; skill < 100; skill++) {
      for (let project = 0; project < 5; project++) {
        files.push(
          makeSkillFile({
            filePath: `/project-${project}/.claude/skills/skill-${skill}/SKILL.md`,
            contentHash: skill % 2 === 0 ? 'even-hash' : 'odd-hash',
          })
        );
      }
    }

    const clusters = buildOverlapClusters(files);
    // 100 clusters (one per skill identity), NOT 1 mega-cluster
    expect(clusters).toHaveLength(100);
    for (const c of clusters) {
      expect(c.files).toHaveLength(5);
    }
  });
});
