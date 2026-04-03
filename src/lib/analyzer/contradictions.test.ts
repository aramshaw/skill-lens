/**
 * Unit tests for buildContradictionFlags()
 *
 * AC1: "Detects mismatches across all compared fields"
 *   → unit (pure logic — groups by filename, compares frontmatter values)
 * AC2: "Only flags fields where values actually differ (not just missing vs present)"
 *   → unit (presence-only entries must NOT produce a flag)
 * AC3: "Severity levels assigned correctly"
 *   → unit (model/effort = warning, allowed-tools/user-invocable = info)
 * AC4: "Unit tests"
 *   → this file
 */

import { describe, it, expect } from 'vitest';
import { buildContradictionFlags } from './contradictions';
import type { SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function makeSkillFile(
  filePath: string,
  frontmatter: Record<string, unknown> = {},
  overrides: Partial<SkillFile> = {}
): SkillFile {
  _idCounter += 1;
  return {
    name: `Skill ${_idCounter}`,
    description: '',
    type: 'skill',
    level: 'project',
    projectName: `project-${_idCounter}`,
    projectPath: `/repos/project-${_idCounter}`,
    frontmatter,
    body: 'body',
    contentHash: `hash-${_idCounter}`,
    filePath,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty / singleton cases
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — empty / singleton', () => {
  it('returns empty array for no files', () => {
    expect(buildContradictionFlags([])).toEqual([]);
  });

  it('returns empty array when only one file exists (nothing to compare)', () => {
    const files = [
      makeSkillFile('/project-a/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('returns empty array when all files have unique filenames (no overlap)', () => {
    const files = [
      makeSkillFile('/project-a/.claude/rules/save.md', { model: 'sonnet' }),
      makeSkillFile('/project-b/.claude/rules/commit.md', { model: 'opus' }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC2: missing-vs-present should NOT be flagged
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — missing vs present (AC2)', () => {
  it('does not flag when only one file has the field', () => {
    const files = [
      makeSkillFile('/project-a/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
      makeSkillFile('/project-b/.claude/skills/save/SKILL.md', {}), // no model field
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('does not flag when no file has the watched field', () => {
    const files = [
      makeSkillFile('/project-a/.claude/skills/save/SKILL.md', { name: 'save' }),
      makeSkillFile('/project-b/.claude/skills/save/SKILL.md', { name: 'save' }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('does not flag when only one file has allowed-tools and the other does not', () => {
    const files = [
      makeSkillFile('/p1/.claude/agents/deploy/SKILL.md', { 'allowed-tools': ['Bash', 'Read'] }),
      makeSkillFile('/p2/.claude/agents/deploy/SKILL.md', {}),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC3: Detects model mismatches (severity = warning)
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — model field (AC1 + AC3)', () => {
  it('flags a model mismatch between two files', () => {
    const files = [
      makeSkillFile(
        '/project-a/.claude/skills/save/SKILL.md',
        { model: 'sonnet' },
        { projectName: 'project-a', level: 'project' }
      ),
      makeSkillFile(
        '/project-b/.claude/skills/save/SKILL.md',
        { model: 'opus' },
        { projectName: 'project-b', level: 'project' }
      ),
    ];

    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(1);
    expect(flags[0].skillName).toBe('SKILL.md');
    expect(flags[0].field).toBe('model');
    expect(flags[0].severity).toBe('warning');
    expect(flags[0].values).toHaveLength(2);
  });

  it('assigns severity warning for model mismatches', () => {
    const files = [
      makeSkillFile('/p1/.claude/agents/agent/SKILL.md', { model: 'haiku' }, { projectName: 'p1', level: 'project' }),
      makeSkillFile('/p2/.claude/agents/agent/SKILL.md', { model: 'sonnet' }, { projectName: 'p2', level: 'project' }),
    ];
    const flags = buildContradictionFlags(files);
    expect(flags[0].severity).toBe('warning');
  });

  it('does not flag when all files share the same model value', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
      makeSkillFile('/p2/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
      makeSkillFile('/p3/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('includes all files that have the field in the values array', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/save/SKILL.md', { model: 'haiku' }, { projectName: 'p1', level: 'project' }),
      makeSkillFile('/p2/.claude/skills/save/SKILL.md', { model: 'sonnet' }, { projectName: 'p2', level: 'project' }),
      makeSkillFile('/p3/.claude/skills/save/SKILL.md', { model: 'opus' }, { projectName: 'p3', level: 'project' }),
    ];
    const flags = buildContradictionFlags(files);
    expect(flags[0].values).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC3: Detects effort mismatches (severity = warning)
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — effort field (AC1 + AC3)', () => {
  it('flags an effort mismatch with severity warning', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/deploy/SKILL.md', { effort: 'high' }, { projectName: 'p1', level: 'project' }),
      makeSkillFile('/p2/.claude/skills/deploy/SKILL.md', { effort: 'low' }, { projectName: 'p2', level: 'project' }),
    ];
    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('effort');
    expect(flags[0].severity).toBe('warning');
  });

  it('does not flag when effort values are identical', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/deploy/SKILL.md', { effort: 'high' }),
      makeSkillFile('/p2/.claude/skills/deploy/SKILL.md', { effort: 'high' }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC3: Detects allowed-tools mismatches (severity = info)
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — allowed-tools field (AC1 + AC3)', () => {
  it('flags an allowed-tools mismatch with severity info', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Read', 'Write'] },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Read'] },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('allowed-tools');
    expect(flags[0].severity).toBe('info');
  });

  it('does not flag when allowed-tools arrays are deeply equal', () => {
    const files = [
      makeSkillFile('/p1/.claude/agents/agent/SKILL.md', { 'allowed-tools': ['Read', 'Write'] }),
      makeSkillFile('/p2/.claude/agents/agent/SKILL.md', { 'allowed-tools': ['Read', 'Write'] }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('flags when allowed-tools differ in order (different serialization)', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Read', 'Write'] },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Write', 'Read'] },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    // Different serialization order → treated as different values
    const flags = buildContradictionFlags(files);
    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('allowed-tools');
  });
});

// ---------------------------------------------------------------------------
// AC1 + AC3: Detects user-invocable mismatches (severity = info)
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — user-invocable field (AC1 + AC3)', () => {
  it('flags a user-invocable mismatch with severity info', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/skills/save/SKILL.md',
        { 'user-invocable': true },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/save/SKILL.md',
        { 'user-invocable': false },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('user-invocable');
    expect(flags[0].severity).toBe('info');
  });

  it('does not flag when user-invocable is the same across copies', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/save/SKILL.md', { 'user-invocable': true }),
      makeSkillFile('/p2/.claude/skills/save/SKILL.md', { 'user-invocable': true }),
    ];
    expect(buildContradictionFlags(files)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Multiple fields contradicting at once
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — multiple fields in one cluster', () => {
  it('emits one flag per contradicting field', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/skills/agent/SKILL.md',
        { model: 'sonnet', effort: 'high', 'user-invocable': true },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/agent/SKILL.md',
        { model: 'opus', effort: 'low', 'user-invocable': false },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);

    // model (warning) + effort (warning) + user-invocable (info) = 3 flags
    expect(flags).toHaveLength(3);

    const fields = flags.map((f) => f.field).sort();
    expect(fields).toEqual(['effort', 'model', 'user-invocable']);

    const warnFlags = flags.filter((f) => f.severity === 'warning');
    const infoFlags = flags.filter((f) => f.severity === 'info');
    expect(warnFlags).toHaveLength(2);
    expect(infoFlags).toHaveLength(1);
  });

  it('only emits flags for fields that actually differ', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/skills/agent/SKILL.md',
        { model: 'sonnet', effort: 'high' },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/agent/SKILL.md',
        { model: 'opus', effort: 'high' }, // effort same, model differs
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('model');
  });
});

// ---------------------------------------------------------------------------
// Multiple skill clusters
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — multiple clusters', () => {
  it('produces flags across multiple different skill filenames', () => {
    const files = [
      // SKILL.md cluster — model mismatch
      makeSkillFile(
        '/p1/.claude/skills/save/SKILL.md',
        { model: 'haiku' },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/save/SKILL.md',
        { model: 'sonnet' },
        { projectName: 'p2', level: 'project' }
      ),
      // deploy.md cluster — effort mismatch
      makeSkillFile(
        '/p1/.claude/rules/deploy.md',
        { effort: 'low' },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/rules/deploy.md',
        { effort: 'high' },
        { projectName: 'p2', level: 'project' }
      ),
    ];

    const flags = buildContradictionFlags(files);

    expect(flags).toHaveLength(2);
    const skillNames = flags.map((f) => f.skillName).sort();
    expect(skillNames).toEqual(['SKILL.md', 'deploy.md']);
  });
});

// ---------------------------------------------------------------------------
// values structure
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — values structure', () => {
  it('values entries include projectName, level, and value', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/skills/save/SKILL.md',
        { model: 'sonnet' },
        { projectName: 'my-project', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/save/SKILL.md',
        { model: 'opus' },
        { projectName: 'other-project', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);
    const values = flags[0].values;

    expect(values[0]).toHaveProperty('projectName');
    expect(values[0]).toHaveProperty('level');
    expect(values[0]).toHaveProperty('value');
  });

  it('uses "(user)" as projectName for user-level files with null projectName', () => {
    const files = [
      makeSkillFile(
        '/home/.claude/skills/save/SKILL.md',
        { model: 'haiku' },
        { projectName: null, level: 'user' }
      ),
      makeSkillFile(
        '/project-a/.claude/skills/save/SKILL.md',
        { model: 'opus' },
        { projectName: 'project-a', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);
    expect(flags).toHaveLength(1);

    const userEntry = flags[0].values.find((v) => v.level === 'user');
    expect(userEntry?.projectName).toBe('(user)');
  });

  it('output is JSON-serializable (no Map or Set values)', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/skills/save/SKILL.md',
        { model: 'sonnet', 'allowed-tools': ['Read'] },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/skills/save/SKILL.md',
        { model: 'opus', 'allowed-tools': ['Write'] },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);
    expect(() => JSON.stringify(flags)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildContradictionFlags — edge cases', () => {
  it('treats filenames as case-sensitive (SKILL.md vs skill.md are different clusters)', () => {
    const files = [
      makeSkillFile('/p1/.claude/skills/save/SKILL.md', { model: 'sonnet' }),
      makeSkillFile('/p2/.claude/skills/save/skill.md', { model: 'opus' }),
    ];
    // Different basenames → no cluster → no flags
    expect(buildContradictionFlags(files)).toEqual([]);
  });

  it('handles non-string frontmatter values (e.g. arrays and booleans)', () => {
    const files = [
      makeSkillFile(
        '/p1/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Read', 'Write'], 'user-invocable': true },
        { projectName: 'p1', level: 'project' }
      ),
      makeSkillFile(
        '/p2/.claude/agents/agent/SKILL.md',
        { 'allowed-tools': ['Bash'], 'user-invocable': false },
        { projectName: 'p2', level: 'project' }
      ),
    ];
    const flags = buildContradictionFlags(files);
    expect(flags).toHaveLength(2);

    const toolsFlag = flags.find((f) => f.field === 'allowed-tools');
    expect(Array.isArray(toolsFlag?.values[0].value)).toBe(true);

    const visFlag = flags.find((f) => f.field === 'user-invocable');
    expect(typeof visFlag?.values[0].value).toBe('boolean');
  });

  it('handles a large number of files efficiently', () => {
    const files: SkillFile[] = [];
    for (let i = 0; i < 200; i++) {
      files.push(
        makeSkillFile(
          `/project-${i}/.claude/skills/common/SKILL.md`,
          { model: i % 2 === 0 ? 'sonnet' : 'opus' },
          { projectName: `project-${i}`, level: 'project' }
        )
      );
    }
    const flags = buildContradictionFlags(files);
    expect(flags).toHaveLength(1);
    expect(flags[0].field).toBe('model');
    expect(flags[0].values).toHaveLength(200);
  });
});
