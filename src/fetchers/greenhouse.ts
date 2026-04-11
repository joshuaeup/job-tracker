import type { CompanyConfig, RawJob } from "../types/index.js";

type GreenhouseResponse = {
  jobs: Record<string, unknown>[];
};

/**
 * Fetches all job postings for a company from the Greenhouse ATS public API.
 * Includes job description content via the `?content=true` query param.
 *
 * @throws {Error} If the HTTP response is not OK.
 */
export default async function fetchGreenhouse(
  config: CompanyConfig
): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${config.slug}/jobs?content=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Greenhouse fetch failed for ${config.name}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as GreenhouseResponse;
  const jobs = data.jobs ?? [];

  return jobs.map((item) => ({
    source: "greenhouse" as const,
    company: config.name,
    raw: item,
  }));
}
