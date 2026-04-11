import { Client } from "@notionhq/client";
import { NormalizedJob } from "../types/index.js";

const NOTION_RATE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSeenUrls(notion: Client, databaseId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.databases.query(
      cursor
        ? { database_id: databaseId, start_cursor: cursor, page_size: 100 }
        : { database_id: databaseId, page_size: 100 }
    );

    for (const page of response.results) {
      if (!("properties" in page)) continue;
      const props = page.properties;

      const urlProp = props["Job Posting URL"];
      if (urlProp?.type === "url" && typeof urlProp.url === "string" && urlProp.url) {
        seen.add(urlProp.url);
      }
    }

    const next = response.has_more ? response.next_cursor : null;
    cursor = typeof next === "string" ? next : undefined;

    if (cursor) {
      await sleep(NOTION_RATE_DELAY_MS);
    }
  } while (cursor);

  return seen;
}

export function deduplicate(
  jobs: NormalizedJob[],
  seenUrls: Set<string>
): NormalizedJob[] {
  return jobs.filter((job) => !seenUrls.has(job.url));
}
