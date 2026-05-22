import { jest } from '@jest/globals';
import type { Client } from '@notionhq/client';

const makeResults = (urls: string[]) =>
  urls.map((url) => ({
    properties: { 'Job Posting URL': { type: 'url', url } },
  }));

/**
 * Builds a mock Notion client that returns a mix of well-formed and malformed
 * results: one page without `properties`, one with a non-URL property type,
 * one with an empty URL, and then the supplied valid URLs.
 */
export const makeMockNotionWithMalformedPages = (urls: string[]): Client =>
  ({
    databases: {
      query: jest.fn().mockResolvedValue({
        results: [
          // page without properties (partial Notion response)
          { object: 'page', id: 'no-props' },
          // page with wrong property type
          {
            properties: {
              'Job Posting URL': { type: 'rich_text', rich_text: [] },
            },
          },
          // page with empty URL string (falsy)
          { properties: { 'Job Posting URL': { type: 'url', url: '' } } },
          ...makeResults(urls),
        ],
        has_more: false,
        next_cursor: null,
      } as never),
    },
  }) as unknown as Client;

/**
 * Builds a mock Notion client whose `databases.query` returns the given URLs
 * as a single page of results with no further pagination.
 */
export const makeMockNotion = (urls: string[]): Client =>
  ({
    databases: {
      query: jest.fn().mockResolvedValue({
        results: makeResults(urls),
        has_more: false,
        next_cursor: null,
      } as never),
    },
  }) as unknown as Client;

/**
 * Builds a mock Notion client that returns results across two pages,
 * simulating paginated responses with has_more: true on the first page.
 */
export const makePaginatedMockNotion = (
  page1Urls: string[],
  page2Urls: string[],
): Client =>
  ({
    databases: {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          results: makeResults(page1Urls),
          has_more: true,
          next_cursor: 'cursor-abc',
        } as never)
        .mockResolvedValueOnce({
          results: makeResults(page2Urls),
          has_more: false,
          next_cursor: null,
        } as never),
    },
  }) as unknown as Client;
