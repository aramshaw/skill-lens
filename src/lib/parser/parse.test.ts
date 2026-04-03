/**
 * Unit tests for parseSkillFile
 *
 * AC1: "parseSkillFile(filePath, level, projectName?) returns SkillFile" → unit (pure function, no HTTP/DOM)
 * AC2: "Correctly extracts all standard frontmatter fields" → unit
 * AC3: "Generates consistent content hash" → unit
 * AC4: "Handles missing/malformed frontmatter gracefully" → unit
 * AC5: "Unit tests for happy path + edge cases" → unit
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';

// Mock the fs module so tests don't touch the real filesystem
vi.mock('fs');

import { parseSkillFile } from './parse';

const mockReadFileSync = vi.mocked(fs.readFileSync);

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFile(content: string) {
  // Cast through unknown to satisfy the overloaded readFileSync signature
  mockReadFileSync.mockReturnValue(content as unknown as ReturnType<typeof fs.readFileSync>);
}

// ---------------------------------------------------------------------------
// AC1 + AC2: Happy path — skill file with full frontmatter
// ---------------------------------------------------------------------------

describe('parseSkillFile — happy path (skill)', () => {
  const SKILL_PATH = '/home/user/.claude/skills/my-skill/SKILL.md';
  const CONTENT = `---
name: My Skill
description: Does something useful
model: sonnet
effort: low
allowed-tools: Read, Write, Edit
user-invocable: true
context: some context
paths:
  - src/
  - lib/
---

# My Skill

This is the body.
`;

  it('returns a SkillFile with correct type and level', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.type).toBe('skill');
    expect(result.level).toBe('user');
  });

  it('extracts name from frontmatter', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.name).toBe('My Skill');
  });

  it('extracts description from frontmatter', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.description).toBe('Does something useful');
  });

  it('extracts model field', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.frontmatter['model']).toBe('sonnet');
  });

  it('extracts allowed-tools field', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.frontmatter['allowed-tools']).toBe('Read, Write, Edit');
  });

  it('extracts user-invocable boolean field', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.frontmatter['user-invocable']).toBe(true);
  });

  it('extracts paths array field', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.frontmatter['paths']).toEqual(['src/', 'lib/']);
  });

  it('extracts markdown body (trimmed)', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.body).toContain('# My Skill');
    expect(result.body).toContain('This is the body.');
  });

  it('sets filePath correctly', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.filePath).toBe(SKILL_PATH);
  });

  it('sets projectName to null when not provided', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'user');
    expect(result.projectName).toBeNull();
  });

  it('sets projectName when provided', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(SKILL_PATH, 'project', 'my-project');
    expect(result.projectName).toBe('my-project');
  });
});

// ---------------------------------------------------------------------------
// Type detection: agent
// ---------------------------------------------------------------------------

describe('parseSkillFile — type detection (agent)', () => {
  const AGENT_PATH = '/home/user/.claude/agents/my-agent/SKILL.md';
  const CONTENT = `---
name: My Agent
description: An agent
---
body
`;

  it('returns type "agent" for agent path', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(AGENT_PATH, 'user');
    expect(result.type).toBe('agent');
  });
});

// ---------------------------------------------------------------------------
// Type detection: rule
// ---------------------------------------------------------------------------

describe('parseSkillFile — type detection (rule)', () => {
  const RULE_PATH = '/home/user/.claude/rules/my-rule.md';
  const CONTENT = `---
name: My Rule
---
body
`;

  it('returns type "rule" for rule path', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(RULE_PATH, 'user');
    expect(result.type).toBe('rule');
  });
});

// ---------------------------------------------------------------------------
// AC3: Consistent content hash
// ---------------------------------------------------------------------------

describe('parseSkillFile — content hash', () => {
  const PATH = '/home/user/.claude/skills/x/SKILL.md';
  const CONTENT = '---\nname: X\n---\nbody';

  it('generates a non-empty hash string', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(PATH, 'user');
    expect(result.contentHash).toBeTruthy();
    expect(typeof result.contentHash).toBe('string');
  });

  it('generates the same hash for the same content', () => {
    mockFile(CONTENT);
    const r1 = parseSkillFile(PATH, 'user');
    mockFile(CONTENT);
    const r2 = parseSkillFile(PATH, 'user');
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it('generates different hashes for different content', () => {
    mockFile(CONTENT);
    const r1 = parseSkillFile(PATH, 'user');
    mockFile(CONTENT + '\nextra line');
    const r2 = parseSkillFile(PATH, 'user');
    expect(r1.contentHash).not.toBe(r2.contentHash);
  });

  it('hash looks like a hex SHA-256 (64 hex chars)', () => {
    mockFile(CONTENT);
    const result = parseSkillFile(PATH, 'user');
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// AC4: Edge cases — missing / malformed frontmatter
// ---------------------------------------------------------------------------

describe('parseSkillFile — edge cases', () => {
  const PATH = '/home/user/.claude/skills/edge/SKILL.md';

  it('handles empty file gracefully', () => {
    mockFile('');
    const result = parseSkillFile(PATH, 'user');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('');
    expect(result.name).toBe('edge'); // falls back to dirname basename
  });

  it('handles file with no frontmatter', () => {
    mockFile('# Just markdown\n\nNo frontmatter here.');
    const result = parseSkillFile(PATH, 'user');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toContain('# Just markdown');
  });

  it('handles file with only frontmatter delimiters and no body', () => {
    mockFile('---\nname: Only FM\n---\n');
    const result = parseSkillFile(PATH, 'user');
    expect(result.name).toBe('Only FM');
    expect(result.body.trim()).toBe('');
  });

  it('handles malformed YAML frontmatter (invalid YAML)', () => {
    // Malformed: key without value
    mockFile('---\n: broken\n  - [\n---\nbody text');
    const result = parseSkillFile(PATH, 'user');
    // Should not throw; frontmatter is empty or partial
    expect(result).toBeDefined();
    expect(result.body).toBeTruthy();
  });

  it('uses dirname basename as name fallback when no name in frontmatter', () => {
    mockFile('---\ndescription: no name field\n---\nbody');
    const result = parseSkillFile(PATH, 'user');
    // PATH has dirname "edge", so name should fall back to "edge"
    expect(result.name).toBe('edge');
  });

  it('falls back to file basename (without extension) for flat file paths', () => {
    mockFile('just body');
    const flatPath = '/home/user/.claude/rules/my-rule.md';
    const result = parseSkillFile(flatPath, 'user');
    expect(result.name).toBe('my-rule');
  });

  it('sets description to empty string when missing from frontmatter', () => {
    mockFile('---\nname: No Desc\n---\nbody');
    const result = parseSkillFile(PATH, 'user');
    expect(result.description).toBe('');
  });

  it('sets projectPath to null when not provided', () => {
    mockFile('---\nname: Test\n---\nbody');
    const result = parseSkillFile(PATH, 'user');
    expect(result.projectPath).toBeNull();
  });

  it('sets projectPath when provided', () => {
    mockFile('---\nname: Test\n---\nbody');
    const result = parseSkillFile(PATH, 'project', 'my-project', '/repos/my-project');
    expect(result.projectPath).toBe('/repos/my-project');
  });
});
