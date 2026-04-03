/**
 * Unit tests for overlap cluster display utilities.
 *
 * AC1: "Each copy shows project name, plugin name, or 'User' — not just the level badge"
 *      → unit (pure display logic, no HTTP/DOM)
 * AC4: "Plugin-level files show which plugin they belong to (derived from parent directory name)"
 *      → unit (pure logic)
 */

import { describe, it, expect } from 'vitest';
import { locationLabel } from './overlaps-utils';
import type { SkillFile } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillFile(overrides: Partial<SkillFile> = {}): SkillFile {
  return {
    filePath: '/some/path/SKILL.md',
    name: 'Test Skill',
    description: '',
    type: 'skill',
    level: 'user',
    projectName: null,
    projectPath: null,
    pluginName: null,
    frontmatter: {},
    body: '',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1 + AC4: locationLabel
// ---------------------------------------------------------------------------

describe('locationLabel — user level', () => {
  it('returns "User" for user-level skills', () => {
    const skill = makeSkillFile({ level: 'user' });
    expect(locationLabel(skill)).toBe('User');
  });

  it('returns "User" even if projectName is set (should not happen, but defensive)', () => {
    const skill = makeSkillFile({ level: 'user', projectName: 'some-project' });
    expect(locationLabel(skill)).toBe('User');
  });
});

describe('locationLabel — project level', () => {
  it('returns the project name for project-level skills', () => {
    const skill = makeSkillFile({
      level: 'project',
      projectName: 'my-app',
      filePath: '/repos/my-app/.claude/skills/save/SKILL.md',
    });
    expect(locationLabel(skill)).toBe('my-app');
  });

  it('falls back to filePath when projectName is null', () => {
    const skill = makeSkillFile({
      level: 'project',
      projectName: null,
      filePath: '/extra/path/.claude/skills/save/SKILL.md',
    });
    expect(locationLabel(skill)).toBe('/extra/path/.claude/skills/save/SKILL.md');
  });
});

describe('locationLabel — plugin level', () => {
  it('returns the plugin name for plugin-level skills (AC4)', () => {
    const skill = makeSkillFile({
      level: 'plugin',
      pluginName: 'my-plugin',
      filePath: '/home/user/.claude/plugins/my-plugin/skills/save/SKILL.md',
    });
    expect(locationLabel(skill)).toBe('my-plugin');
  });

  it('falls back to filePath when pluginName is null', () => {
    const skill = makeSkillFile({
      level: 'plugin',
      pluginName: null,
      filePath: '/home/user/.claude/plugins/unknown-plugin/SKILL.md',
    });
    expect(locationLabel(skill)).toBe('/home/user/.claude/plugins/unknown-plugin/SKILL.md');
  });
});
