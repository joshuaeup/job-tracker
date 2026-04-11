import { CompanyConfig, RawJob } from "../types/index.js";

export default async function fetchLever(
  config: CompanyConfig
): Promise<RawJob[]> {
  const url = `https://api.lever.co/v0/postings/${config.slug}?mode=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Lever fetch failed for ${config.name}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>[];

  return data.map((item) => ({
    source: "lever" as const,
    company: config.name,
    raw: item,
  }));
}
