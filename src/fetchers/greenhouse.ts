import { CompanyConfig, RawJob } from "../types/index.js";

interface GreenhouseResponse {
  jobs: Record<string, unknown>[];
}

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
