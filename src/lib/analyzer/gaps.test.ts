/**
 * Unit tests for buildGapFlags()
 *
 * AC1: Correctly identifies gaps — skills present in some projects but missing from others
 * AC2: Respects coverage threshold — only flags gaps where coverage is >= 50%
 * AC3: Excludes user-level skills from gap analysis (they're available everywhere)
 * AC4: Unit tests with mock data
 */

// AC1: "Correctly identifies gaps" → unit (pure logic, no I/O)
// AC2: "Respects coverage threshold" → unit (pure logic)
// AC3: "Excludes user-level skills" → unit (pure logic)
// AC4: "Unit tests" → unit

import { describe, it, expect } from 'vitest';
import { buildGapFlags } from './gaps';
import type { SkillFile, Project, GapFlag } from '@/lib/types';

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

function makeProject(name: string, skills: SkillFile[] = []): Project {
  return {
    name,
    path: `/repos/${name}`,
    skills,
  };
}

// ---------------------------------------------------------------------------
// AC3: User-level skills are excluded
// ---------------------------------------------------------------------------

describe('buildGapFlags — user-level exclusion', () => {
  it('returns empty array when all skills are user-level', () => {
    const userSkill = makeSkillFile({
      filePath: '/home/user/.claude/skills/save/SKILL.md',
      level: 'user',
      projectName: null,
      projectPath: null,
    });
    const projectA = makeProject('project-a');
    const projectB = makeProject('project-b');

    const result = buildGapFlags([userSkill], [projectA, projectB]);
    expect(result).toEqual([]);
  });

  it('does not flag user-level skills as gaps even when project-level copies exist', () => {
    const userSkill = makeSkillFile({
      filePath: '/home/user/.claude/skills/save/SKILL.md',
      level: 'user',
      projectName: null,
      projectPath: null,
      contentHash: 'user-hash',
    });
    const projectSkill = makeSkillFile({
      filePath: '/repos/project-a/.claude/skills/save/SKILL.md',
      level: 'project',
      projectName: 'project-a',
      projectPath: '/repos/project-a',
      contentHash: 'proj-hash',
    });
    const projectA = makeProject('project-a', [projectSkill]);
    const projectB = makeProject('project-b');

    // Only the user skill and the project skill exist for 'SKILL.md',
    // but the user skill should be excluded from gap analysis.
    // project-b doesn't have SKILL.md — but since only 1 project (project-a)
    // has it, coverage = 1 of 2 = 50%, which meets threshold.
    const result = buildGapFlags([userSkill, projectSkill], [projectA, projectB]);

    // Verify no gap entry uses user-level as a presentIn source for the filename
    // (user-level files are excluded entirely from gap analysis)
    for (const flag of result) {
      for (const p of flag.presentIn) {
        expect(p.level).not.toBe('user');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: Coverage threshold >= 50%
// ---------------------------------------------------------------------------

describe('buildGapFlags — coverage threshold', () => {
  it('does not flag a skill present in only 1 of 4 projects (25% < 50%)', () => {
    const skill = makeSkillFile({
      filePath: '/repos/project-a/.claude/skills/rare/SKILL.md',
      projectName: 'project-a',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skill]),
      makeProject('project-b'),
      makeProject('project-c'),
      makeProject('project-d'),
    ];

    const result = buildGapFlags([skill], projects);
    expect(result).toEqual([]);
  });

  it('does not flag a skill present in 1 of 3 projects (33% < 50%)', () => {
    const skill = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/check.md',
      projectName: 'project-a',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skill]),
      makeProject('project-b'),
      makeProject('project-c'),
    ];

    const result = buildGapFlags([skill], projects);
    expect(result).toEqual([]);
  });

  it('flags a skill present in exactly 50% of projects (2 of 4)', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c'),
      makeProject('project-d'),
    ];

    const result = buildGapFlags([skillA, skillB], projects);
    expect(result).toHaveLength(1);
    expect(result[0].skillName).toBe('lint.md');
  });

  it('flags a skill present in 3 of 4 projects (75% >= 50%)', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const skillC = makeSkillFile({
      filePath: '/repos/project-c/.claude/rules/lint.md',
      projectName: 'project-c',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c', [skillC]),
      makeProject('project-d'),
    ];

    const result = buildGapFlags([skillA, skillB, skillC], projects);
    expect(result).toHaveLength(1);
    expect(result[0].skillName).toBe('lint.md');
    expect(result[0].missingFrom).toHaveLength(1);
    expect(result[0].missingFrom[0].projectName).toBe('project-d');
  });

  it('does not flag a skill present in all projects (no gap)', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
    ];

    const result = buildGapFlags([skillA, skillB], projects);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC1: Gap detection correctness
// ---------------------------------------------------------------------------

describe('buildGapFlags — gap detection', () => {
  it('returns empty array for empty inputs', () => {
    expect(buildGapFlags([], [])).toEqual([]);
  });

  it('returns empty array when there is only one project', () => {
    const skill = makeSkillFile({
      filePath: '/repos/project-a/.claude/skills/save/SKILL.md',
      projectName: 'project-a',
      level: 'project',
    });
    const projects = [makeProject('project-a', [skill])];

    const result = buildGapFlags([skill], projects);
    expect(result).toEqual([]);
  });

  it('identifies the correct missing projects', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/style.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/style.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c'), // missing
    ];

    const result = buildGapFlags([skillA, skillB], projects);

    expect(result).toHaveLength(1);
    const flag = result[0];
    expect(flag.skillName).toBe('style.md');
    expect(flag.presentIn).toHaveLength(2);
    expect(flag.missingFrom).toHaveLength(1);
    expect(flag.missingFrom[0].projectName).toBe('project-c');
  });

  it('sets presentIn with correct projectName and level', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/skills/deploy/SKILL.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/agents/deploy/SKILL.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c'),
    ];

    const result = buildGapFlags([skillA, skillB], projects);
    expect(result).toHaveLength(1);

    const presentNames = result[0].presentIn.map((p) => p.projectName);
    expect(presentNames).toContain('project-a');
    expect(presentNames).toContain('project-b');

    for (const p of result[0].presentIn) {
      expect(p.level).toBe('project');
    }
  });

  it('produces correct coverage string', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const skillC = makeSkillFile({
      filePath: '/repos/project-c/.claude/rules/lint.md',
      projectName: 'project-c',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c', [skillC]),
      makeProject('project-d'),
      makeProject('project-e'),
    ];

    const result = buildGapFlags([skillA, skillB, skillC], projects);
    expect(result).toHaveLength(1);
    expect(result[0].coverage).toBe('3 of 5 projects');
  });

  it('handles multiple gap flags from mixed skills', () => {
    // lint.md: 2 of 3 projects → gap
    const lintA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const lintB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });

    // style.md: 2 of 3 projects → gap
    const styleA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/style.md',
      projectName: 'project-a',
      level: 'project',
    });
    const styleC = makeSkillFile({
      filePath: '/repos/project-c/.claude/rules/style.md',
      projectName: 'project-c',
      level: 'project',
    });

    // unique.md: only 1 project — not a gap (below threshold)
    const uniqueB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/unique.md',
      projectName: 'project-b',
      level: 'project',
    });

    const projects = [
      makeProject('project-a', [lintA, styleA]),
      makeProject('project-b', [lintB, uniqueB]),
      makeProject('project-c', [styleC]),
    ];

    const result = buildGapFlags([lintA, lintB, styleA, styleC, uniqueB], projects);

    expect(result).toHaveLength(2);
    const skillNames = result.map((f) => f.skillName).sort();
    expect(skillNames).toEqual(['lint.md', 'style.md']);
  });

  it('handles plugin-level skills (included in gap analysis like project-level)', () => {
    const pluginSkill = makeSkillFile({
      filePath: '/home/user/.claude/plugins/my-plugin/skills/deploy.md',
      level: 'plugin',
      projectName: null,
      projectPath: null,
    });
    // plugin skills have no projectName, so they can't be flagged as missing from a project
    // They should be treated as present in no project context
    const projectSkill = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/deploy.md',
      level: 'project',
      projectName: 'project-a',
      projectPath: '/repos/project-a',
    });
    const projects = [
      makeProject('project-a', [projectSkill]),
      makeProject('project-b'),
    ];

    // Only 1 project (project-a) has deploy.md at project level
    // 1 of 2 = 50% → should be flagged
    const result = buildGapFlags([pluginSkill, projectSkill], projects);
    // The plugin skill has no projectName, so only project-a counts as "present"
    // 1 of 2 projects = 50% >= 50% → flagged
    expect(result).toHaveLength(1);
    expect(result[0].skillName).toBe('deploy.md');
    expect(result[0].missingFrom[0].projectName).toBe('project-b');
  });
});

// ---------------------------------------------------------------------------
// GapFlag shape validation
// ---------------------------------------------------------------------------

describe('buildGapFlags — output shape', () => {
  it('each GapFlag is JSON-serializable', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c'),
    ];

    const result = buildGapFlags([skillA, skillB], projects);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('GapFlag has all required fields', () => {
    const skillA = makeSkillFile({
      filePath: '/repos/project-a/.claude/rules/lint.md',
      projectName: 'project-a',
      level: 'project',
    });
    const skillB = makeSkillFile({
      filePath: '/repos/project-b/.claude/rules/lint.md',
      projectName: 'project-b',
      level: 'project',
    });
    const projects = [
      makeProject('project-a', [skillA]),
      makeProject('project-b', [skillB]),
      makeProject('project-c'),
    ];

    const result = buildGapFlags([skillA, skillB], projects);
    const flag: GapFlag = result[0];

    expect(typeof flag.skillName).toBe('string');
    expect(Array.isArray(flag.presentIn)).toBe(true);
    expect(Array.isArray(flag.missingFrom)).toBe(true);
    expect(typeof flag.coverage).toBe('string');
  });
});
