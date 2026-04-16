import type { Client } from "@notionhq/client";
import type { NormalizedJob } from "../types/index.js";

const NOTION_RATE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prefetches all existing job posting URLs from the Notion Job Tracker
 * database into a `Set` for O(1) per-role deduplication.
 *
 * Uses paginated queries with a 400ms delay between pages to respect
 * Notion's rate limit of 3 req/sec.
 */
export async function fetchSeenUrls(
  notion: Client,
  databaseId: string,
): Promise<Set<string>> {
  const seen = new Set<string>();
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.databases.query(
      cursor
        ? { database_id: databaseId, start_cursor: cursor, page_size: 100 }
        : { database_id: databaseId, page_size: 100 },
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

/**
 * Returns only the jobs whose URL does not appear in the `seenUrls` set.
 */
export function deduplicate(
  jobs: NormalizedJob[],
  seenUrls: Set<string>,
): NormalizedJob[] {
  return jobs.filter((job) => !seenUrls.has(job.url));
}
