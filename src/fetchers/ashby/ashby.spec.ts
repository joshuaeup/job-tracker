import { jest } from '@jest/globals';

import { fetchAshby } from './ashby.js';
import { fakeAshbyJob, fakeAshbyResponse } from './factories/ashby.factory.js';
import { makeAshbyConfig, mockFetch } from './mocks/ashby.mocks.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchAshby', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the API returns job postings', () => {
    it('returns one RawJob per posting with source set to "ashby"', async () => {
      const jobs = [fakeAshbyJob(), fakeAshbyJob()];
      mockFetch(fakeAshbyResponse(jobs));

      const result = await fetchAshby(makeAshbyConfig());

      expect(result).toHaveLength(2);
      expect(result[0]?.source).toBe('ashby');
    });

    it('sets the company name from the config on every result', async () => {
      mockFetch(fakeAshbyResponse([fakeAshbyJob()]));

      const result = await fetchAshby(makeAshbyConfig({ name: 'Initech' }));

      expect(result[0]?.company).toBe('Initech');
    });

    it('preserves the raw job fields in the raw property', async () => {
      const job = fakeAshbyJob({ title: 'Staff Engineer' });
      mockFetch(fakeAshbyResponse([job]));

      const result = await fetchAshby(makeAshbyConfig());

      expect((result[0]?.raw as { title: string }).title).toBe(
        'Staff Engineer',
      );
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when the API returns no jobs', async () => {
      mockFetch(fakeAshbyResponse([]));

      const result = await fetchAshby(makeAshbyConfig());

      expect(result).toHaveLength(0);
    });

    it('constructs the correct API URL from the slug', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(fakeAshbyResponse([])),
      } as Response);

      await fetchAshby(makeAshbyConfig({ slug: 'my-company' }));

      expect(spy).toHaveBeenCalledWith(
        'https://api.ashbyhq.com/posting-api/job-board/my-company',
      );
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the HTTP response is not OK', async () => {
      mockFetch({}, false, 404);

      await expect(fetchAshby(makeAshbyConfig())).rejects.toThrow(
        'Ashby fetch failed for Acme Corp: 404',
      );
    });

    it('includes the company name in the error message', async () => {
      mockFetch({}, false, 500);

      await expect(
        fetchAshby(makeAshbyConfig({ name: 'Globex' })),
      ).rejects.toThrow('Globex');
    });
  });
});
