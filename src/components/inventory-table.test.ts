/**
 * Unit tests for InventoryTable utility logic.
 *
 * AC1: "Plugin-level skills show a meaningful value in the PROJECT column"
 *      → unit (pure display logic: getProjectColumnValue)
 * AC2: "Table uses pagination for large datasets"
 *      → unit (pure pagination logic: paginateSkills, getPageCount)
 * AC3: "Default view prioritizes user's own project and user-level skills over plugin content"
 *      → unit (pure sort order: applyDefaultSort)
 */

import { describe, it, expect } from 'vitest';
import {
  getProjectColumnValue,
  paginateSkills,
  getPageCount,
  applyDefaultSort,
} from './inventory-table';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<SkillFile> = {}): SkillFile {
  return {
    filePath: '/home/user/.claude/skills/test/SKILL.md',
    name: 'Test Skill',
    description: '',
    type: 'skill',
    level: 'project',
    projectName: 'my-app',
    projectPath: '/repos/my-app',
    pluginName: null,
    frontmatter: {},
    body: '',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1: getProjectColumnValue — PROJECT column display value
// ---------------------------------------------------------------------------

describe('getProjectColumnValue — AC1: meaningful PROJECT column values', () => {
  it('returns projectName for project-level skills', () => {
    const skill = makeSkill({ level: 'project', projectName: 'skill-lens', pluginName: null });
    expect(getProjectColumnValue(skill)).toBe('skill-lens');
  });

  it('returns null for project-level skills with no projectName', () => {
    const skill = makeSkill({ level: 'project', projectName: null, pluginName: null });
    expect(getProjectColumnValue(skill)).toBeNull();
  });

  it('returns pluginName for plugin-level skills', () => {
    const skill = makeSkill({ level: 'plugin', projectName: null, pluginName: 'nextjs' });
    expect(getProjectColumnValue(skill)).toBe('nextjs');
  });

  it('returns null for plugin-level skills with no pluginName', () => {
    // Edge case: plugin-level but pluginName not populated
    const skill = makeSkill({ level: 'plugin', projectName: null, pluginName: null });
    expect(getProjectColumnValue(skill)).toBeNull();
  });

  it('returns null for user-level skills (no project or plugin)', () => {
    const skill = makeSkill({ level: 'user', projectName: null, pluginName: null });
    expect(getProjectColumnValue(skill)).toBeNull();
  });

  it('prefers pluginName over projectName for plugin-level skills', () => {
    // Shouldn't happen in practice, but defensive test
    const skill = makeSkill({
      level: 'plugin',
      projectName: 'some-project',
      pluginName: 'my-plugin',
    });
    expect(getProjectColumnValue(skill)).toBe('my-plugin');
  });
});

// ---------------------------------------------------------------------------
// AC2: paginateSkills / getPageCount — pagination logic
// ---------------------------------------------------------------------------

describe('paginateSkills — AC2: pagination slicing', () => {
  const skills = Array.from({ length: 25 }, (_, i) =>
    makeSkill({ filePath: `/path/skill-${i}.md`, name: `Skill ${i}` })
  );

  it('returns the first page (page 1) correctly', () => {
    const page = paginateSkills(skills, 1, 10);
    expect(page).toHaveLength(10);
    expect(page[0].name).toBe('Skill 0');
    expect(page[9].name).toBe('Skill 9');
  });

  it('returns the second page correctly', () => {
    const page = paginateSkills(skills, 2, 10);
    expect(page).toHaveLength(10);
    expect(page[0].name).toBe('Skill 10');
    expect(page[9].name).toBe('Skill 19');
  });

  it('returns a partial last page', () => {
    const page = paginateSkills(skills, 3, 10);
    expect(page).toHaveLength(5);
    expect(page[0].name).toBe('Skill 20');
  });

  it('returns empty array for page beyond last page', () => {
    const page = paginateSkills(skills, 4, 10);
    expect(page).toHaveLength(0);
  });

  it('returns all items on page 1 when pageSize exceeds total', () => {
    const page = paginateSkills(skills, 1, 100);
    expect(page).toHaveLength(25);
  });

  it('handles empty input gracefully', () => {
    const page = paginateSkills([], 1, 10);
    expect(page).toHaveLength(0);
  });

  it('clamps to first item when page is 0 or negative (page 1 fallback)', () => {
    // Negative/zero page treated as page 1
    const page = paginateSkills(skills, 0, 10);
    expect(page).toHaveLength(10);
    expect(page[0].name).toBe('Skill 0');
  });
});

describe('getPageCount — AC2: total page count', () => {
  it('returns 3 pages for 25 items with pageSize 10', () => {
    expect(getPageCount(25, 10)).toBe(3);
  });

  it('returns 1 page for exactly pageSize items', () => {
    expect(getPageCount(10, 10)).toBe(1);
  });

  it('returns 1 page for fewer items than pageSize', () => {
    expect(getPageCount(5, 10)).toBe(1);
  });

  it('returns 0 pages for empty list', () => {
    expect(getPageCount(0, 10)).toBe(0);
  });

  it('returns correct page count for exactly divisible sizes', () => {
    expect(getPageCount(20, 5)).toBe(4);
  });

  it('rounds up for non-divisible sizes', () => {
    expect(getPageCount(11, 5)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC3: applyDefaultSort — priority sort (user > project > plugin)
// ---------------------------------------------------------------------------

describe('applyDefaultSort — AC3: default sort prioritizes user and project over plugin', () => {
  it('places user-level skills before project-level skills', () => {
    const skills = [
      makeSkill({ level: 'project', name: 'B Project', projectName: 'proj' }),
      makeSkill({ level: 'user', name: 'A User', projectName: null }),
    ];
    const sorted = applyDefaultSort(skills);
    expect(sorted[0].level).toBe('user');
    expect(sorted[1].level).toBe('project');
  });

  it('places project-level skills before plugin-level skills', () => {
    const skills = [
      makeSkill({ level: 'plugin', name: 'A Plugin', pluginName: 'plug' }),
      makeSkill({ level: 'project', name: 'B Project', projectName: 'proj' }),
    ];
    const sorted = applyDefaultSort(skills);
    expect(sorted[0].level).toBe('project');
    expect(sorted[1].level).toBe('plugin');
  });

  it('places user-level skills before plugin-level skills', () => {
    const skills = [
      makeSkill({ level: 'plugin', name: 'A Plugin', pluginName: 'plug' }),
      makeSkill({ level: 'user', name: 'B User', projectName: null }),
    ];
    const sorted = applyDefaultSort(skills);
    expect(sorted[0].level).toBe('user');
    expect(sorted[1].level).toBe('plugin');
  });

  it('sorts alphabetically by name within the same level', () => {
    const skills = [
      makeSkill({ level: 'project', name: 'Zebra', projectName: 'proj' }),
      makeSkill({ level: 'project', name: 'Alpha', projectName: 'proj' }),
      makeSkill({ level: 'project', name: 'Middle', projectName: 'proj' }),
    ];
    const sorted = applyDefaultSort(skills);
    expect(sorted.map((s) => s.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });

  it('full mixed sort: user < project < plugin, each alpha within level', () => {
    const skills = [
      makeSkill({ level: 'plugin', name: 'Z-Plugin', pluginName: 'z-plug' }),
      makeSkill({ level: 'plugin', name: 'A-Plugin', pluginName: 'a-plug' }),
      makeSkill({ level: 'project', name: 'B-Project', projectName: 'proj' }),
      makeSkill({ level: 'project', name: 'A-Project', projectName: 'proj' }),
      makeSkill({ level: 'user', name: 'B-User', projectName: null }),
      makeSkill({ level: 'user', name: 'A-User', projectName: null }),
    ];
    const sorted = applyDefaultSort(skills);
    expect(sorted.map((s) => s.name)).toEqual([
      'A-User',
      'B-User',
      'A-Project',
      'B-Project',
      'A-Plugin',
      'Z-Plugin',
    ]);
  });

  it('does not mutate the original array', () => {
    const skills = [
      makeSkill({ level: 'plugin', name: 'Plugin' }),
      makeSkill({ level: 'user', name: 'User' }),
    ];
    const original = [...skills];
    applyDefaultSort(skills);
    expect(skills[0].name).toBe(original[0].name);
  });
});
