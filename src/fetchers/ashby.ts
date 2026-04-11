import { CompanyConfig, RawJob } from "../types/index.js";

interface AshbyResponse {
  jobPostings: Record<string, unknown>[];
}

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
  const postings = data.jobPostings ?? [];

  return postings.map((item) => ({
    source: "ashby" as const,
    company: config.name,
    raw: item,
  }));
}
