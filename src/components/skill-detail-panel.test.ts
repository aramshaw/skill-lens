/**
 * Unit tests for SkillDetailPanel utility logic (getHeaderBadgeInfo)
 *
 * AC1: "Type badge (skill/agent/rule) shown in detail panel header" → unit (pure badge logic)
 * AC2: "Level badge (user/project/plugin) shown in detail panel header" → unit (pure badge logic)
 * AC3: "Project or plugin name shown when applicable" → unit (pure badge logic)
 * AC4: "Metadata visible without scrolling — positioned between title and description" → e2e (visual rendering — deferred)
 */

import { describe, it, expect } from 'vitest';
import { getHeaderBadgeInfo } from './skill-detail-panel';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<SkillFile>): SkillFile {
  return {
    filePath: '/home/user/.claude/skills/test/SKILL.md',
    name: 'Test Skill',
    description: 'A test skill',
    type: 'skill',
    level: 'user',
    projectName: null,
    projectPath: null,
    pluginName: null,
    frontmatter: { name: 'Test Skill', description: 'A test skill' },
    body: '# Test Skill\n\nThis is the body.',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getHeaderBadgeInfo — type badge
// ---------------------------------------------------------------------------

describe('getHeaderBadgeInfo — type badge', () => {
  it('returns "skill" label for skill type', () => {
    const skill = makeSkill({ type: 'skill' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.typeLabel).toBe('skill');
  });

  it('returns "agent" label for agent type', () => {
    const skill = makeSkill({ type: 'agent' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.typeLabel).toBe('agent');
  });

  it('returns "rule" label for rule type', () => {
    const skill = makeSkill({ type: 'rule' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.typeLabel).toBe('rule');
  });

  it('returns a non-empty typeClass for each type', () => {
    for (const type of ['skill', 'agent', 'rule'] as const) {
      const info = getHeaderBadgeInfo(makeSkill({ type }));
      expect(info.typeClass.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getHeaderBadgeInfo — level badge
// ---------------------------------------------------------------------------

describe('getHeaderBadgeInfo — level badge', () => {
  it('returns "user" label for user level', () => {
    const skill = makeSkill({ level: 'user' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.levelLabel).toBe('user');
  });

  it('returns "project" label for project level', () => {
    const skill = makeSkill({ level: 'project', projectName: 'my-app' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.levelLabel).toBe('project');
  });

  it('returns "plugin" label for plugin level', () => {
    const skill = makeSkill({ level: 'plugin', pluginName: 'my-plugin' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.levelLabel).toBe('plugin');
  });

  it('returns a non-empty levelClass for each level', () => {
    for (const level of ['user', 'project', 'plugin'] as const) {
      const info = getHeaderBadgeInfo(makeSkill({ level }));
      expect(info.levelClass.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getHeaderBadgeInfo — context label (project / plugin name)
// ---------------------------------------------------------------------------

describe('getHeaderBadgeInfo — context label', () => {
  it('returns null contextLabel for user-level skills', () => {
    const skill = makeSkill({ level: 'user', projectName: null, pluginName: null });
    const info = getHeaderBadgeInfo(skill);
    expect(info.contextLabel).toBeNull();
  });

  it('returns projectName as contextLabel for project-level skills', () => {
    const skill = makeSkill({ level: 'project', projectName: 'skill-lens', pluginName: null });
    const info = getHeaderBadgeInfo(skill);
    expect(info.contextLabel).toBe('skill-lens');
  });

  it('returns pluginName as contextLabel for plugin-level skills', () => {
    const skill = makeSkill({ level: 'plugin', projectName: null, pluginName: 'my-plugin' });
    const info = getHeaderBadgeInfo(skill);
    expect(info.contextLabel).toBe('my-plugin');
  });

  it('returns null contextLabel when projectName is null for project-level', () => {
    // Edge case: project-level but no projectName (shouldn't happen in practice)
    const skill = makeSkill({ level: 'project', projectName: null, pluginName: null });
    const info = getHeaderBadgeInfo(skill);
    expect(info.contextLabel).toBeNull();
  });

  it('returns null contextLabel when pluginName is null for plugin-level', () => {
    // Edge case: plugin-level but no pluginName
    const skill = makeSkill({ level: 'plugin', projectName: null, pluginName: null });
    const info = getHeaderBadgeInfo(skill);
    expect(info.contextLabel).toBeNull();
  });
});
