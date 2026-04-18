import { jest } from '@jest/globals';
import type { Client } from '@notionhq/client';

/**
 * Builds a mock Notion client whose `databases.query` returns the given URLs
 * as a single page of results with no further pagination.
 */
export const makeMockNotion = (urls: string[]): Client => {
  const results = urls.map((url) => ({
    properties: {
      'Job Posting URL': { type: 'url', url },
    },
  }));

  return {
    databases: {
      query: jest.fn().mockResolvedValue({
        results,
        has_more: false,
        next_cursor: null,
      } as never),
    },
  } as unknown as Client;
};
