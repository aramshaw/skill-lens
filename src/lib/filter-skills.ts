import type { SkillFile } from "@/lib/types";
import type { ProjectFilter } from "@/components/project-sidebar";

/**
 * Filters a list of skills by the active project filter.
 *
 * - null → all skills (no filter)
 * - "__user__" → user-level skills only
 * - "__plugin__" → plugin-level skills only
 * - any other string → skills from that named project
 *
 * Pure function — does not mutate the input array.
 */
export function filterSkillsByProject(
  skills: SkillFile[],
  filter: ProjectFilter
): SkillFile[] {
  if (filter === null) return skills;
  if (filter === "__user__") return skills.filter((s) => s.level === "user");
  if (filter === "__plugin__") return skills.filter((s) => s.level === "plugin");
  // Include both project-level skills for this project AND user-level skills
  // (user-level skills are active in every project)
  return skills.filter((s) => s.projectName === filter || s.level === "user");
}
