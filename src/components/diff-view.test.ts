/**
 * Unit tests for DiffView utility logic (computeFileDiff, serializeSkillFile)
 *
 * AC1: "Side-by-side diff renders correctly" → unit (pure logic)
 * AC2: "Diff highlighting for additions/deletions" → unit
 * AC3: "Works for both frontmatter and body differences" → unit
 * AC4: "File selector when cluster has 3+ files" → unit (selector state logic)
 * AC5: "Handles identical files gracefully" → unit
 */

import { describe, it, expect } from 'vitest';
import { computeFileDiff, serializeSkillFile } from './diff-view';
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
    frontmatter: { name: 'Test Skill', description: 'A test skill' },
    body: '# Test Skill\n\nThis is the body.',
    contentHash: 'abc123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// serializeSkillFile: converts SkillFile to a text string for diffing
// ---------------------------------------------------------------------------

describe('serializeSkillFile', () => {
  it('produces a non-empty string', () => {
    const skill = makeSkill({});
    const text = serializeSkillFile(skill);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('includes frontmatter fields', () => {
    const skill = makeSkill({ frontmatter: { name: 'My Skill', model: 'sonnet' } });
    const text = serializeSkillFile(skill);
    expect(text).toContain('name: My Skill');
    expect(text).toContain('model: sonnet');
  });

  it('includes the body content', () => {
    const skill = makeSkill({ body: '# Hello\n\nWorld' });
    const text = serializeSkillFile(skill);
    expect(text).toContain('# Hello');
    expect(text).toContain('World');
  });

  it('wraps frontmatter in --- delimiters', () => {
    const skill = makeSkill({ frontmatter: { name: 'X' } });
    const text = serializeSkillFile(skill);
    expect(text).toMatch(/^---\n/);
    expect(text).toContain('\n---\n');
  });

  it('handles empty frontmatter', () => {
    const skill = makeSkill({ frontmatter: {} });
    const text = serializeSkillFile(skill);
    expect(text).toBeDefined();
  });

  it('handles empty body', () => {
    const skill = makeSkill({ body: '' });
    const text = serializeSkillFile(skill);
    expect(text).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// computeFileDiff: returns line-level diff between two SkillFiles
// ---------------------------------------------------------------------------

describe('computeFileDiff — identical files', () => {
  it('returns isIdentical = true when content is the same', () => {
    const skill = makeSkill({});
    const result = computeFileDiff(skill, skill);
    expect(result.isIdentical).toBe(true);
  });

  it('returns isIdentical = true when content is deeply equal but different objects', () => {
    const a = makeSkill({ contentHash: 'hash1' });
    const b = makeSkill({ contentHash: 'hash2' }); // hash differs but content same
    const result = computeFileDiff(a, b);
    expect(result.isIdentical).toBe(true);
  });

  it('all lines are "equal" type when files are identical', () => {
    const skill = makeSkill({});
    const result = computeFileDiff(skill, skill);
    const allEqual = result.lines.every((l) => l.type === 'equal');
    expect(allEqual).toBe(true);
  });
});

describe('computeFileDiff — different files', () => {
  it('returns isIdentical = false when content differs', () => {
    const a = makeSkill({ body: '# Old body' });
    const b = makeSkill({ body: '# New body' });
    const result = computeFileDiff(a, b);
    expect(result.isIdentical).toBe(false);
  });

  it('returns lines containing added/removed/equal types', () => {
    const a = makeSkill({ body: 'line one\nline two' });
    const b = makeSkill({ body: 'line one\nline three' });
    const result = computeFileDiff(a, b);
    const types = result.lines.map((l) => l.type);
    expect(types).toContain('equal');
    // Should have some changed lines
    const hasChange = types.includes('added') || types.includes('removed');
    expect(hasChange).toBe(true);
  });

  it('detects frontmatter differences', () => {
    const a = makeSkill({ frontmatter: { name: 'Skill A', model: 'sonnet' } });
    const b = makeSkill({ frontmatter: { name: 'Skill A', model: 'haiku' } });
    const result = computeFileDiff(a, b);
    expect(result.isIdentical).toBe(false);
    const removedLines = result.lines.filter((l) => l.type === 'removed');
    const addedLines = result.lines.filter((l) => l.type === 'added');
    expect(removedLines.some((l) => l.text.includes('sonnet'))).toBe(true);
    expect(addedLines.some((l) => l.text.includes('haiku'))).toBe(true);
  });

  it('detects body differences', () => {
    const a = makeSkill({ frontmatter: {}, body: 'old content' });
    const b = makeSkill({ frontmatter: {}, body: 'new content' });
    const result = computeFileDiff(a, b);
    expect(result.isIdentical).toBe(false);
    const removed = result.lines.filter((l) => l.type === 'removed');
    const added = result.lines.filter((l) => l.type === 'added');
    expect(removed.some((l) => l.text.includes('old content'))).toBe(true);
    expect(added.some((l) => l.text.includes('new content'))).toBe(true);
  });

  it('each line has a text property', () => {
    const a = makeSkill({ body: 'foo' });
    const b = makeSkill({ body: 'bar' });
    const result = computeFileDiff(a, b);
    result.lines.forEach((line) => {
      expect(typeof line.text).toBe('string');
    });
  });
});
