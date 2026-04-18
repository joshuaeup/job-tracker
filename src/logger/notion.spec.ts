import { fakeNormalizedJob } from '../testing/factories/normalized-job.factory.js';
import { makeMockNotionLogger } from './mocks/notion.mocks.js';
import { logJobsToNotion } from './notion.js';

describe('logJobsToNotion', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when all pages are created successfully', () => {
    it('returns the count of logged jobs', async () => {
      const notion = makeMockNotionLogger();
      const jobs = [fakeNormalizedJob(), fakeNormalizedJob()];

      const result = await logJobsToNotion(notion, 'db-id', jobs);

      expect(result).toBe(2);
    });

    it('creates one Notion page per job', async () => {
      const notion = makeMockNotionLogger();
      const jobs = [fakeNormalizedJob(), fakeNormalizedJob()];

      await logJobsToNotion(notion, 'db-id', jobs);

      expect(notion.pages.create).toHaveBeenCalledTimes(2);
    });

    it('sets the company as the page title', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ company: 'Acme Corp' });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            Company: {
              title: [{ text: { content: 'Acme Corp' } }],
            },
          }),
        }),
      );
    });

    it('sets the job posting URL property', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ url: 'https://example.com/job/123' });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'Job Posting URL': { url: 'https://example.com/job/123' },
          }),
        }),
      );
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns 0 when jobs list is empty', async () => {
      const notion = makeMockNotionLogger();

      const result = await logJobsToNotion(notion, 'db-id', []);

      expect(result).toBe(0);
    });

    it('does not call pages.create when jobs list is empty', async () => {
      const notion = makeMockNotionLogger();

      await logJobsToNotion(notion, 'db-id', []);

      expect(notion.pages.create).not.toHaveBeenCalled();
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('skips a failed job and continues logging the rest', async () => {
      const notion = makeMockNotionLogger([1]); // first call fails
      const jobs = [fakeNormalizedJob(), fakeNormalizedJob()];

      const result = await logJobsToNotion(notion, 'db-id', jobs);

      expect(result).toBe(1);
    });

    it('returns 0 when every job fails to log', async () => {
      const notion = makeMockNotionLogger([1, 2]);
      const jobs = [fakeNormalizedJob(), fakeNormalizedJob()];

      const result = await logJobsToNotion(notion, 'db-id', jobs);

      expect(result).toBe(0);
    });
  });
});
