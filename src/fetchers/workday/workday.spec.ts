import { jest } from '@jest/globals';

import {
  fakeWorkdayJob,
  fakeWorkdayResponse,
} from './factories/workday.factory.js';
import { makeWorkdayConfig, mockFetch } from './mocks/workday.mocks.js';
import { fetchWorkday } from './workday.js';

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
        'https://acme.wd5.myworkdayjobs.com',
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
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when the API returns no jobs', async () => {
      mockFetch(fakeWorkdayResponse([]));

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
