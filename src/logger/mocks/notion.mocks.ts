import { jest } from '@jest/globals';
import type { Client } from '@notionhq/client';

/**
 * Builds a mock Notion client whose `pages.create` either resolves or rejects
 * based on `shouldFail`. Use `shouldFail` for individual calls by providing a
 * set of 1-based call indices that should reject.
 */
export const makeMockNotionLogger = (
  shouldFailOnCalls: number[] = [],
): Client => {
  let callCount = 0;

  return {
    pages: {
      create: jest.fn().mockImplementation(() => {
        callCount++;
        if (shouldFailOnCalls.includes(callCount)) {
          return Promise.reject(new Error('Notion API error'));
        }
        return Promise.resolve({ id: `page-${callCount}` });
      }),
    },
  } as unknown as Client;
};
