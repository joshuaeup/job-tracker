import type { NormalizedJob } from "../types/index.js";
import { TARGET_ROLE_PROFILE } from "../config/target-role-profile.js";

/**
 * System prompt injected into every Claude evaluation call.
 * Includes the candidate's Target Role Profile and the expected JSON output schema.
 */
export const SYSTEM_PROMPT = `You are a precise job fit evaluator. Return only valid JSON. No preamble, no explanation, no markdown.

${TARGET_ROLE_PROFILE}

## Output Schema

Return exactly this JSON structure:
{
  "fitScore": <number 0-100>,
  "recommendation": <"apply" | "research" | "skip">,
  "summary": "<2-3 sentence plain-language assessment>",
  "flags": ["<flag1>", "<flag2>", ...]
}

## Scoring Guidance

- 85–100: Strong match on stack, remote, seniority, and salary → recommend "apply"
- 70–84: Good match with minor gaps (salary unknown, partial remote) → recommend "research"
- 50–69: Some alignment but notable gaps → recommend "research" or "skip" based on severity
- Below 50: Material mismatches on multiple dimensions → recommend "skip"
`;

/**
 * Builds the user-turn message for a Claude evaluation call from a normalized job.
 * Caps description text at 2,000 characters to control token cost.
 */
export function buildUserMessage(job: NormalizedJob): string {
  const salary =
    job.salaryMin !== null && job.salaryMax !== null
      ? `$${job.salaryMin.toLocaleString()}–$${job.salaryMax.toLocaleString()}`
      : job.salaryMin !== null
        ? `$${job.salaryMin.toLocaleString()}+`
        : "Not listed";

  return `Job Title:   ${job.title}
Company:     ${job.company}
Location:    ${job.location} (Remote: ${job.remote})
Department:  ${job.department}
Salary:      ${salary}

Description:
${job.descriptionText.slice(0, 2000)}`;
}
