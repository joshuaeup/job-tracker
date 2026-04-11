import type { NormalizedJob } from "../types/index.js";

const TITLE_ALLOWLIST = [
  "backend",
  "back-end",
  "back end",
  "software engineer",
  "software developer",
  "node",
  "nodejs",
  "node.js",
  "typescript",
  "api",
  "platform",
  "tech lead",
  "staff engineer",
];

const SENIORITY_BLOCKLIST = [
  "intern",
  "junior",
  "jr.",
  " jr ",
  "associate",
  "principal",
  "distinguished",
  "vp of",
];

function passesTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return TITLE_ALLOWLIST.some((kw) => lower.includes(kw));
}

function passesLocation(job: NormalizedJob): boolean {
  if (!job.location) return true;
  const lower = job.location.toLowerCase();
  return job.remote || lower.includes("charlotte") || lower.includes("remote");
}

function passesSeniority(title: string): boolean {
  const lower = title.toLowerCase();
  return !SENIORITY_BLOCKLIST.some((kw) => lower.includes(kw));
}

/**
 * Applies title keyword, location, and seniority filters to a list of
 * normalized jobs. The filter is intentionally permissive — it removes
 * obvious mismatches only. Precision screening is the evaluator's job.
 *
 * @returns The subset of jobs that pass all active filters.
 */
export function filter(jobs: NormalizedJob[]): NormalizedJob[] {
  const passed: NormalizedJob[] = [];

  for (const job of jobs) {
    if (!passesTitle(job.title)) continue;
    if (!passesSeniority(job.title)) continue;
    if (!passesLocation(job)) continue;
    passed.push(job);
  }

  return passed;
}
