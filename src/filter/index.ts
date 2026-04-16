import type { NormalizedJob } from "../types/index.js";

const TITLE_ALLOWLIST = [
  "backend",
  "back-end",
  "back end",
  "senior software engineer",
  "senior software developer",
  "senior developer",
  "senior typescript",
  "software engineer",
  "software developer",
  "typescript",
  "api",
  "platform",
];

const SENIORITY_BLOCKLIST = [
  "intern",
  "junior",
  "jr",
  "associate",
  "principal",
  "distinguished",
  "vp",
  "fullstack",
  "full-stack",
  "full stack",
  "manager",
  "director",
  "principal",
  "staff",
  "android",
  "ios",
  "mobile",
  "advocate",
  "frontend",
  "front-end",
  "front end",
];

const TITLE_ALLOWLIST_PATTERNS = TITLE_ALLOWLIST.map(
  (kw) => new RegExp(`\\b${kw.replace(/[-]/g, "\\-")}\\b`, "i")
);

function passesTitle(title: string): boolean {
  return TITLE_ALLOWLIST_PATTERNS.some((re) => re.test(title));
}

const COUNTRY_BLOCKLIST = [
  "canada",
  "india",
  "uk",
  "united kingdom",
  "london",
  "germany",
  "france",
  "australia",
  "singapore",
  "mexico",
  "japan",
  "ireland",
  "netherlands",
  "spain",
  "sweden",
  "brazil",
];

function passesLocation(job: NormalizedJob): boolean {
  if (!job.location) return true;
  const lower = job.location.toLowerCase();

  // Block non-US locations regardless of the remote flag — some ATS mark
  // international office roles as isRemote:true (e.g. Notion/Ashby Hyderabad)
  if (COUNTRY_BLOCKLIST.some((country) => lower.includes(country))) return false;

  return (
    job.remote ||
    lower.includes("remote") ||
    lower.includes("charlotte")
  );
}

const SENIORITY_BLOCKLIST_PATTERNS = SENIORITY_BLOCKLIST.map(
  (kw) => new RegExp(`\\b${kw.replace(/[-]/g, "\\-")}\\b`, "i")
);

function passesSeniority(title: string): boolean {
  return !SENIORITY_BLOCKLIST_PATTERNS.some((re) => re.test(title));
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
