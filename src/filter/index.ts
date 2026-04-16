import type { NormalizedJob } from "../types/index.js";
import rolesConfig from "../config/roles.json" with { type: "json" };

const TITLE_ALLOWLIST: string[] = rolesConfig.titleAllowlist;
const SENIORITY_BLOCKLIST: string[] = rolesConfig.titleBlocklist;

const TITLE_ALLOWLIST_PATTERNS = TITLE_ALLOWLIST.map(
  (kw) => new RegExp(`\\b${kw.replace(/[-]/g, "\\-")}\\b`, "i"),
);

function passesTitle(title: string): boolean {
  return TITLE_ALLOWLIST_PATTERNS.some((re) => re.test(title));
}

const COUNTRY_BLOCKLIST = [
  "canada",
  "toronto",
  "vancouver",
  "montreal",
  "ottawa",
  "calgary",
  ", can",
  "-can",
  "india",
  "hyderabad",
  "bangalore",
  "bengaluru",
  "uk",
  "united kingdom",
  "london",
  "germany",
  "berlin",
  "france",
  "paris",
  "australia",
  "sydney",
  "melbourne",
  "singapore",
  "mexico",
  "japan",
  "tokyo",
  "ireland",
  "dublin",
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

  return job.remote || lower.includes("remote") || lower.includes("charlotte");
}

const SENIORITY_BLOCKLIST_PATTERNS = SENIORITY_BLOCKLIST.map(
  (kw) => new RegExp(`\\b${kw.replace(/[-]/g, "\\-")}\\b`, "i"),
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
