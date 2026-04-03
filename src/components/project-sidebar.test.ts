/**
 * Unit tests for ProjectSidebar utility logic (computeProjectCounts)
 *
 * AC1: "Sidebar lists all projects with counts" → unit (pure count computation)
 * AC2: "Clicking filters the inventory table" → e2e (browser interaction — deferred)
 * AC3: "All Projects clears filter" → e2e (browser interaction — deferred)
 * AC4: "Active filter visually indicated" → e2e (visual rendering — deferred)
 * AC5: "Responsive on narrow screens" → e2e (visual rendering — deferred)
 *
 * We unit-test the pure logic: computeProjectCounts, which derives sidebar entries
 * from a flat list of SkillFiles. Browser interaction tests are covered by e2e.
 */

import { describe, it, expect } from 'vitest';
import { computeProjectCounts } from './project-sidebar';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<SkillFile>): SkillFile {
  return {
    filePath: '/home/user/.claude/skills/test/SKILL.md',
    name: 'Test Skill',
    description: '',
    type: 'skill',
    level: 'project',
    projectName: 'my-app',
    projectPath: '/repos/my-app',
    frontmatter: {},
    body: '',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeProjectCounts
// ---------------------------------------------------------------------------

describe('computeProjectCounts — empty input', () => {
  it('returns three sections with zero counts on empty skill list', () => {
    const result = computeProjectCounts([]);
    expect(result.projects).toEqual([]);
    expect(result.userCount).toBe(0);
    expect(result.pluginCount).toBe(0);
  });
});

describe('computeProjectCounts — project skills', () => {
  it('groups skills by projectName', () => {
    const skills = [
      makeSkill({ projectName: 'app-a', level: 'project' }),
      makeSkill({ projectName: 'app-a', level: 'project' }),
      makeSkill({ projectName: 'app-b', level: 'project' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.projects).toHaveLength(2);
    const a = result.projects.find((p) => p.name === 'app-a');
    const b = result.projects.find((p) => p.name === 'app-b');
    expect(a?.count).toBe(2);
    expect(b?.count).toBe(1);
  });

  it('sorts projects alphabetically by name', () => {
    const skills = [
      makeSkill({ projectName: 'zebra', level: 'project' }),
      makeSkill({ projectName: 'alpha', level: 'project' }),
      makeSkill({ projectName: 'middle', level: 'project' }),
    ];
    const result = computeProjectCounts(skills);
    const names = result.projects.map((p) => p.name);
    expect(names).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('excludes skills with null projectName from project list', () => {
    const skills = [
      makeSkill({ projectName: null, level: 'user' }),
      makeSkill({ projectName: 'real-project', level: 'project' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe('real-project');
  });
});

describe('computeProjectCounts — user and plugin skills', () => {
  it('counts user-level skills separately', () => {
    const skills = [
      makeSkill({ projectName: null, level: 'user' }),
      makeSkill({ projectName: null, level: 'user' }),
      makeSkill({ projectName: null, level: 'user' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.userCount).toBe(3);
    expect(result.pluginCount).toBe(0);
  });

  it('counts plugin-level skills separately', () => {
    const skills = [
      makeSkill({ projectName: null, level: 'plugin' }),
      makeSkill({ projectName: null, level: 'plugin' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.pluginCount).toBe(2);
    expect(result.userCount).toBe(0);
  });

  it('handles mixed levels correctly', () => {
    const skills = [
      makeSkill({ projectName: 'proj', level: 'project' }),
      makeSkill({ projectName: null, level: 'user' }),
      makeSkill({ projectName: null, level: 'plugin' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].count).toBe(1);
    expect(result.userCount).toBe(1);
    expect(result.pluginCount).toBe(1);
  });
});

describe('computeProjectCounts — total', () => {
  it('provides a total skill count across all entries', () => {
    const skills = [
      makeSkill({ projectName: 'proj', level: 'project' }),
      makeSkill({ projectName: 'proj', level: 'project' }),
      makeSkill({ projectName: null, level: 'user' }),
      makeSkill({ projectName: null, level: 'plugin' }),
    ];
    const result = computeProjectCounts(skills);
    expect(result.total).toBe(4);
  });
});
