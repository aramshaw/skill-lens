/**
 * Filesystem scanner — walks discovered projects and user-level directories
 * to find all skill, agent, and rule markdown files.
 *
 * This module is server-side only (Node.js). It is intentionally read-only:
 * it never writes to any file.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import fg from 'fast-glob';
import { parseSkillFile } from '@/lib/parser/parse';
import type { Project, ScanResult, SkillFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Glob patterns (relative) to scan within any skill-aware directory. */
const SKILL_PATTERNS = [
  '.claude/skills/**/*.md',
  '.claude/agents/**/*.md',
  '.claude/rules/**/*.md',
];

/** Fast-glob options shared across all scans. */
const FG_OPTIONS: fg.Options = {
  absolute: true,
  onlyFiles: true,
  dot: true,
  // Suppress errors for inaccessible directories
  suppressErrors: true,
};

/**
 * Safely glob for markdown files under a given base directory.
 * Returns an empty array if the directory is inaccessible or doesn't exist.
 */
async function safeGlob(patterns: string[]): Promise<string[]> {
  try {
    return await fg(patterns, FG_OPTIONS);
  } catch {
    return [];
  }
}

/**
 * Safely parse a single skill file.
 * Returns null if parsing fails (e.g. EACCES, malformed content).
 */
function safeParse(
  filePath: string,
  level: SkillFile['level'],
  projectName: string | null,
  projectPath: string | null,
  pluginName: string | null = null
): SkillFile | null {
  try {
    return parseSkillFile(filePath, level, projectName, projectPath, pluginName);
  } catch {
    return null;
  }
}

/**
 * Build glob patterns for a given root directory, with the SKILL_PATTERNS
 * applied relative to it. Uses forward slashes for cross-platform compat.
 */
function patternsFor(rootDir: string): string[] {
  const normalized = rootDir.replace(/\\/g, '/');
  return SKILL_PATTERNS.map((p) => `${normalized}/${p}`);
}

// ---------------------------------------------------------------------------
// Level scanners
// ---------------------------------------------------------------------------

/**
 * Scan a single project directory for skill/agent/rule files.
 * Returns the populated skills array for that project.
 */
async function scanProject(project: Project): Promise<SkillFile[]> {
  const patterns = patternsFor(project.path);
  const filePaths = await safeGlob(patterns);

  const skills: SkillFile[] = [];
  for (const filePath of filePaths) {
    const parsed = safeParse(filePath, 'project', project.name, project.path);
    if (parsed) {
      skills.push(parsed);
    }
  }
  return skills;
}

/**
 * Scan user-level directories (~/.claude/skills, ~/.claude/agents, ~/.claude/rules).
 */
async function scanUserLevel(homeDir: string): Promise<SkillFile[]> {
  const claudeDir = path.join(homeDir, '.claude').replace(/\\/g, '/');
  const patterns = [
    `${claudeDir}/skills/**/*.md`,
    `${claudeDir}/agents/**/*.md`,
    `${claudeDir}/rules/**/*.md`,
  ];

  const filePaths = await safeGlob(patterns);

  const skills: SkillFile[] = [];
  for (const filePath of filePaths) {
    const parsed = safeParse(filePath, 'user', null, null);
    if (parsed) {
      skills.push(parsed);
    }
  }
  return skills;
}

/**
 * Scan plugin-level directories (~/.claude/plugins/<plugin-name>/).
 * Each subdirectory under ~/.claude/plugins/ is treated as a plugin.
 */
async function scanPluginLevel(homeDir: string): Promise<SkillFile[]> {
  const pluginsDir = path.join(homeDir, '.claude', 'plugins').replace(/\\/g, '/');

  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  // Read subdirectories — each is a plugin
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true }) as fs.Dirent[];
  } catch {
    return [];
  }

  const pluginEntries = entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: path.join(pluginsDir, e.name).replace(/\\/g, '/') }));

  const skills: SkillFile[] = [];

  for (const { name: pluginName, dir: pluginDir } of pluginEntries) {
    // Plugins may keep skills/agents directly in root or under .claude/ subdirs
    const patterns = [
      `${pluginDir}/**/*.md`,
    ];

    const filePaths = await safeGlob(patterns);
    for (const filePath of filePaths) {
      const parsed = safeParse(filePath, 'plugin', null, null, pluginName);
      if (parsed) {
        skills.push(parsed);
      }
    }
  }

  return skills;
}

/**
 * Scan an additional (manually added) path the same way as a project,
 * but without a project name (treated as an anonymous extra path).
 */
async function scanAdditionalPath(dirPath: string): Promise<SkillFile[]> {
  const name = path.basename(dirPath);
  const normalized = dirPath.replace(/\\/g, '/');
  const project: Project = { name, path: normalized, skills: [] };
  return scanProject(project);
}

// Re-export deduplicateSkills so callers can import from this module.
// The implementation lives in lib/skills.ts (no server-only deps) so it can
// also be imported safely from client components.
export { deduplicateSkills } from '@/lib/skills';

// ---------------------------------------------------------------------------
// Stat counters
// ---------------------------------------------------------------------------

function countByType(files: SkillFile[]): { skills: number; agents: number; rules: number } {
  let skills = 0;
  let agents = 0;
  let rules = 0;
  for (const f of files) {
    if (f.type === 'skill') skills++;
    else if (f.type === 'agent') agents++;
    else if (f.type === 'rule') rules++;
  }
  return { skills, agents, rules };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scan all projects plus user- and plugin-level directories for skill files.
 *
 * @param projects        Projects discovered via discoverProjects() (or supplied manually).
 * @param additionalPaths Optional extra directories to scan (e.g., added via UI).
 * @returns               A complete ScanResult.
 */
export async function scanAll(
  projects: Project[],
  additionalPaths: string[] = []
): Promise<ScanResult> {
  const homeDir = os.homedir();

  // --- Scan all levels concurrently for performance ---

  // 1. Project-level scans (one per project)
  const projectScanPromises = projects.map((p) => scanProject(p));

  // 2. Additional paths (treated like projects)
  const additionalScanPromises = additionalPaths.map(scanAdditionalPath);

  // 3. User-level scan
  const userScanPromise = scanUserLevel(homeDir);

  // 4. Plugin-level scan
  const pluginScanPromise = scanPluginLevel(homeDir);

  // Wait for all scans
  const [projectSkillArrays, additionalSkillArrays, userSkills, pluginSkills] =
    await Promise.all([
      Promise.all(projectScanPromises),
      Promise.all(additionalScanPromises),
      userScanPromise,
      pluginScanPromise,
    ]);

  // Build a set of filePaths already covered by user-level and plugin-level scans.
  // Any project-level skill that shares a filePath with a user/plugin skill is a
  // duplicate — most commonly caused by the home directory being listed as a project
  // in ~/.claude.json, which makes ~/.claude/skills/** appear at both levels.
  const higherLevelPaths = new Set<string>([
    ...userSkills.map((s) => s.filePath),
    ...pluginSkills.map((s) => s.filePath),
  ]);

  // Populate project.skills in-place (clone to avoid mutating input), filtering
  // out any files that are already present at user or plugin level.
  const populatedProjects: Project[] = projects.map((p, i) => ({
    ...p,
    skills: projectSkillArrays[i].filter((s) => !higherLevelPaths.has(s.filePath)),
  }));

  // Merge additional path results into userSkills (they show as anonymous project entries)
  // Per the architecture spec, additionalPaths are extra directories — keep them separate
  // but we need to surface them. We fold them into a synthetic project entry.
  const additionalProjects: Project[] = additionalPaths.map((dirPath, i) => ({
    name: path.basename(dirPath),
    path: dirPath.replace(/\\/g, '/'),
    skills: additionalSkillArrays[i],
  }));

  const allProjects = [...populatedProjects, ...additionalProjects];

  // --- Aggregate stats ---
  const allProjectSkills = projectSkillArrays.flat().concat(additionalSkillArrays.flat());
  const allFiles = [...allProjectSkills, ...userSkills, ...pluginSkills];
  const counts = countByType(allFiles);

  console.log(
    `[skill-lens] Scan complete — ` +
      `${counts.skills} skill(s), ${counts.agents} agent(s), ${counts.rules} rule(s) ` +
      `across ${allProjects.length} project(s) + user-level + plugin-level`
  );

  return {
    projects: allProjects,
    userSkills,
    pluginSkills,
    scannedAt: new Date().toISOString(),
  };
}
