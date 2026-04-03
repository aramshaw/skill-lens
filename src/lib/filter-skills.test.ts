/**
 * Unit tests for filterSkillsByProject utility
 *
 * AC1: "Dashboard stat cards update to reflect the active project filter" → unit (pure filter logic)
 */

import { describe, it, expect } from 'vitest';
import { filterSkillsByProject } from './filter-skills';
import type { SkillFile } from '@/lib/types';

function makeSkill(overrides: Partial<SkillFile> = {}): SkillFile {
  return {
    filePath: '/path/skill.md',
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

const userSkill = makeSkill({ level: 'user', projectName: null, projectPath: null, filePath: '/user/skill.md' });
const projectSkillA = makeSkill({ level: 'project', projectName: 'app-a', filePath: '/a/skill.md' });
const projectSkillB = makeSkill({ level: 'project', projectName: 'app-b', filePath: '/b/skill.md' });
const pluginSkill = makeSkill({ level: 'plugin', projectName: null, pluginName: 'nextjs', filePath: '/plugin/skill.md' });

const allSkills = [userSkill, projectSkillA, projectSkillB, pluginSkill];

describe('filterSkillsByProject', () => {
  it('returns all skills when filter is null (All Projects)', () => {
    const result = filterSkillsByProject(allSkills, null);
    expect(result).toHaveLength(4);
  });

  it('returns only user-level skills when filter is "__user__"', () => {
    const result = filterSkillsByProject(allSkills, '__user__');
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('user');
  });

  it('returns only plugin-level skills when filter is "__plugin__"', () => {
    const result = filterSkillsByProject(allSkills, '__plugin__');
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('plugin');
  });

  it('returns only skills from named project', () => {
    const result = filterSkillsByProject(allSkills, 'app-a');
    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('app-a');
  });

  it('returns empty array when no skills match the named project', () => {
    const result = filterSkillsByProject(allSkills, 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const skills = [...allSkills];
    filterSkillsByProject(skills, '__user__');
    expect(skills).toHaveLength(4);
  });
});
