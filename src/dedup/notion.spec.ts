import { jest } from '@jest/globals';
import type { Client } from '@notionhq/client';

import { fakeNormalizedJob } from '../testing/factories/normalized-job.factory.js';
import { deduplicate } from './notion.js';

const makeMockNotion = (urls: string[]): Client => {
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

describe('deduplicate', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when no jobs have been seen before', () => {
    it('returns all jobs unchanged', async () => {
      const notion = makeMockNotion([]);
      const jobs = [
        fakeNormalizedJob({ url: 'https://example.com/job1' }),
        fakeNormalizedJob({ url: 'https://example.com/job2' }),
      ];

      const result = await deduplicate(notion, 'db-id', jobs);

      expect(result).toHaveLength(2);
    });
  });

  describe('when some jobs are already seen', () => {
    it('filters out jobs whose URLs are already in Notion', async () => {
      const notion = makeMockNotion(['https://example.com/job1']);
      const jobs = [
        fakeNormalizedJob({ url: 'https://example.com/job1' }),
        fakeNormalizedJob({ url: 'https://example.com/job2' }),
      ];

      const result = await deduplicate(notion, 'db-id', jobs);

      expect(result).toHaveLength(1);
      expect(result[0]?.url).toBe('https://example.com/job2');
    });

    it('preserves the original order of non-duplicate jobs', async () => {
      const notion = makeMockNotion(['https://example.com/job2']);
      const jobs = [
        fakeNormalizedJob({ url: 'https://example.com/job1' }),
        fakeNormalizedJob({ url: 'https://example.com/job2' }),
        fakeNormalizedJob({ url: 'https://example.com/job3' }),
      ];

      const result = await deduplicate(notion, 'db-id', jobs);

      expect(result).toHaveLength(2);
      expect(result[0]?.url).toBe('https://example.com/job1');
      expect(result[1]?.url).toBe('https://example.com/job3');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty array when input jobs list is empty', async () => {
      const notion = makeMockNotion(['https://example.com/job1']);

      const result = await deduplicate(notion, 'db-id', []);

      expect(result).toHaveLength(0);
    });

    it('returns empty array when all jobs are duplicates', async () => {
      const job = fakeNormalizedJob({ url: 'https://example.com/job1' });
      const notion = makeMockNotion([job.url]);

      const result = await deduplicate(notion, 'db-id', [job]);

      expect(result).toHaveLength(0);
    });

    it('does exact URL matching — a URL prefix does not count as seen', async () => {
      const notion = makeMockNotion(['https://example.com/jobs/12']);
      const jobs = [fakeNormalizedJob({ url: 'https://example.com/jobs/123' })];

      const result = await deduplicate(notion, 'db-id', jobs);

      expect(result).toHaveLength(1);
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('handles a job with an empty string URL without throwing', async () => {
      const notion = makeMockNotion([]);
      const jobs = [fakeNormalizedJob({ url: '' })];

      await expect(deduplicate(notion, 'db-id', jobs)).resolves.not.toThrow();
    });
  });
});
