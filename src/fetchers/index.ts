import { CompanyConfig, RawJob } from "../types/index.js";
import fetchGreenhouse from "./greenhouse.js";
import fetchLever from "./lever.js";
import fetchAshby from "./ashby.js";

const FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
} as const;

export async function fetchAll(companies: CompanyConfig[]): Promise<RawJob[]> {
  const enabled = companies.filter((c) => c.enabled);
  const allJobs: RawJob[] = [];

  for (const company of enabled) {
    try {
      console.log(`[FETCH] Fetching ${company.name} (${company.ats})`);
      const fetcher = FETCHERS[company.ats];
      const jobs = await fetcher(company);
      console.log(`[FETCH] ${company.name}: ${jobs.length} jobs`);
      allJobs.push(...jobs);
    } catch (err) {
      console.error(
        `[FETCH] Error fetching ${company.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return allJobs;
}
