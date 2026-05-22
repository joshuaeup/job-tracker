import { jest } from '@jest/globals';

import {
  fakeWorkdayJob,
  fakeWorkdayResponse,
} from './factories/workday.factory.js';
import { makeWorkdayConfig, mockFetch } from './mocks/workday.mocks.js';
import { fetchWorkday, fetchWorkdayDescription } from './workday.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchWorkday', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the API returns job postings', () => {
    it('returns one RawJob per posting with source set to "workday"', async () => {
      const jobs = [fakeWorkdayJob(), fakeWorkdayJob()];
      mockFetch(fakeWorkdayResponse(jobs));

      const result = await fetchWorkday(makeWorkdayConfig());

      expect(result).toHaveLength(2);
      expect(result[0]?.source).toBe('workday');
    });

    it('sets the company name from the config on every result', async () => {
      mockFetch(fakeWorkdayResponse([fakeWorkdayJob()]));

      const result = await fetchWorkday(makeWorkdayConfig({ name: 'Initech' }));

      expect(result[0]?.company).toBe('Initech');
    });

    it('injects __baseUrl into the raw payload', async () => {
      mockFetch(fakeWorkdayResponse([fakeWorkdayJob()]));

      const result = await fetchWorkday(
        makeWorkdayConfig({ slug: 'acme.wd5/acme/search' }),
      );

      expect((result[0]?.raw as { __baseUrl: string }).__baseUrl).toBe(
        'https://acme.wd5.myworkdayjobs.com/en-US/search',
      );
    });

    it('fetches multiple pages when total exceeds page size', async () => {
      const firstPageJobs = Array.from({ length: 20 }, () => fakeWorkdayJob());
      const secondPageJobs = [fakeWorkdayJob()];

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({ jobPostings: firstPageJobs, total: 21 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({ jobPostings: secondPageJobs, total: 21 }),
        } as Response);

      const result = await fetchWorkday(makeWorkdayConfig());

      expect(result).toHaveLength(21);
    });

    it('continues paginating when subsequent pages return total: 0', async () => {
      const firstPageJobs = Array.from({ length: 20 }, () => fakeWorkdayJob());
      const secondPageJobs = Array.from({ length: 20 }, () => fakeWorkdayJob());
      const thirdPageJobs = [fakeWorkdayJob()];

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({ jobPostings: firstPageJobs, total: 41 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () =>
            Promise.resolve({ jobPostings: secondPageJobs, total: 0 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ jobPostings: thirdPageJobs, total: 0 }),
        } as Response);

      const result = await fetchWorkday(makeWorkdayConfig());

      expect(result).toHaveLength(41);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when the API returns no jobs', async () => {
      mockFetch(fakeWorkdayResponse([]));

      const result = await fetchWorkday(makeWorkdayConfig());

      expect(result).toHaveLength(0);
    });

    it('returns an empty array when jobPostings is absent from the response', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ total: 0 }),
      } as Response);

      const result = await fetchWorkday(makeWorkdayConfig());

      expect(result).toHaveLength(0);
    });

    it('constructs the correct API URL from the slug', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(fakeWorkdayResponse([])),
      } as Response);

      await fetchWorkday(makeWorkdayConfig({ slug: 'acme.wd5/acme/search' }));

      expect(spy).toHaveBeenCalledWith(
        'https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/search/jobs',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the slug is missing a slash separator', async () => {
      await expect(
        fetchWorkday(makeWorkdayConfig({ slug: 'invalidslugnoslash' })),
      ).rejects.toThrow('must be formatted as');
    });

    it('throws when the HTTP response is not OK', async () => {
      mockFetch({}, false, 500);

      await expect(fetchWorkday(makeWorkdayConfig())).rejects.toThrow(
        'Workday fetch failed for Acme Corp: 500',
      );
    });

    it('includes the company name in the error message on HTTP failure', async () => {
      mockFetch({}, false, 500);

      await expect(
        fetchWorkday(makeWorkdayConfig({ name: 'Globex' })),
      ).rejects.toThrow('Globex');
    });
  });
});

describe('fetchWorkdayDescription', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the detail endpoint returns a description', () => {
    it('fetches the CXS URL derived from the en-US job URL', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobPostingInfo: { jobDescription: '' } }),
      } as Response);

      await fetchWorkdayDescription(
        'https://vanguard.wd5.myworkdayjobs.com/en-US/vanguard_external/job/Charlotte-NC/Engineer_177694',
      );

      expect(spy).toHaveBeenCalledWith(
        'https://vanguard.wd5.myworkdayjobs.com/wday/cxs/vanguard/vanguard_external/job/Charlotte-NC/Engineer_177694',
      );
    });

    it('returns plain text with HTML tags stripped', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            jobPostingInfo: {
              jobDescription: '<p>We offer <b>$130,000</b> – $160,000.</p>',
            },
          }),
      } as Response);

      const result = await fetchWorkdayDescription(
        'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Eng_1',
      );

      expect(result).not.toContain('<');
      expect(result).toContain('$130,000');
    });

    it('decodes HTML entities before stripping tags', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            jobPostingInfo: {
              jobDescription:
                '&lt;span&gt;$165,000&lt;/span&gt;&amp;mdash;&lt;span&gt;$180,000&lt;/span&gt;',
            },
          }),
      } as Response);

      const result = await fetchWorkdayDescription(
        'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Eng_1',
      );

      expect(result).toContain('$165,000');
      expect(result).toContain('$180,000');
      expect(result).not.toContain('<');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty string when jobDescription is absent', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobPostingInfo: {} }),
      } as Response);

      const result = await fetchWorkdayDescription(
        'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Eng_1',
      );

      expect(result).toBe('');
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('returns an empty string when the fetch response is not OK', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await fetchWorkdayDescription(
        'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Eng_1',
      );

      expect(result).toBe('');
    });
  });
});
