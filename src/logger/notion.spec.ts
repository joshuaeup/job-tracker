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

  describe('location normalisation', () => {
    const locationCases: Array<[string, boolean, string]> = [
      ['Charlotte, NC', false, 'Charlotte NC'],
      ['New York City', false, 'New York'],
      ['NYC office', false, 'New York'],
      ['somewhere in NY', false, 'New York'],
      ['London, UK', false, 'London'],
      ['Fort Mill, SC', false, 'Fort Mill SC'],
      ['Remote - US', false, 'Remote'],
      ['San Francisco, California', false, 'San Francisco'],
      ['Austin', false, 'Austin'],
    ];

    it.each(locationCases)(
      'maps "%s" (remote=%s) to "%s"',
      async (location, remote, expected) => {
        const notion = makeMockNotionLogger();
        const job = fakeNormalizedJob({ location, remote });

        await logJobsToNotion(notion, 'db-id', [job]);

        expect(notion.pages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: expect.objectContaining({
              Location: { select: { name: expected } },
            }),
          }),
        );
      },
    );

    it('uses "Remote" for a job flagged remote regardless of location string', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ remote: true, location: 'New York' });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            Location: { select: { name: 'Remote' } },
          }),
        }),
      );
    });
  });

  describe('salary formatting', () => {
    it('shows min–max range when both salary values are present', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ salaryMin: 120_000, salaryMax: 160_000 });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'Salary Range': {
              rich_text: [{ text: { content: '$120,000–$160,000' } }],
            },
          }),
        }),
      );
    });

    it('shows min+ when only salaryMin is present', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ salaryMin: 100_000, salaryMax: null });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'Salary Range': {
              rich_text: [{ text: { content: '$100,000+' } }],
            },
          }),
        }),
      );
    });

    it('shows "Not listed" when salary is absent', async () => {
      const notion = makeMockNotionLogger();
      const job = fakeNormalizedJob({ salaryMin: null, salaryMax: null });

      await logJobsToNotion(notion, 'db-id', [job]);

      expect(notion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'Salary Range': {
              rich_text: [{ text: { content: 'Not listed' } }],
            },
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
