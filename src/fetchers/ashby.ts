import type { CompanyConfig, RawJob } from "../types/index.js";

type AshbyResponse = {
  jobs: Record<string, unknown>[];
};

/**
 * Fetches all job postings for a company from the Ashby ATS public API.
 *
 * @throws {Error} If the HTTP response is not OK.
 */
export default async function fetchAshby(
  config: CompanyConfig
): Promise<RawJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${config.slug}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Ashby fetch failed for ${config.name}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as AshbyResponse;
  const postings = data.jobs ?? [];

  return postings.map((item) => ({
    source: "ashby" as const,
    company: config.name,
    raw: item,
  }));
}
