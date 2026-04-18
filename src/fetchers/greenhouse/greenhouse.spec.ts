import { jest } from '@jest/globals';

import {
  fakeGreenhouseJob,
  fakeGreenhouseResponse,
} from './factories/greenhouse.factory.js';
import { fetchGreenhouse } from './greenhouse.js';
import { makeGreenhouseConfig, mockFetch } from './mocks/greenhouse.mocks.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchGreenhouse', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the API returns job postings', () => {
    it('returns one RawJob per posting with source set to "greenhouse"', async () => {
      const jobs = [fakeGreenhouseJob(), fakeGreenhouseJob()];
      mockFetch(fakeGreenhouseResponse(jobs));

      const result = await fetchGreenhouse(makeGreenhouseConfig());

      expect(result).toHaveLength(2);
      expect(result[0]?.source).toBe('greenhouse');
    });

    it('sets the company name from the config on every result', async () => {
      mockFetch(fakeGreenhouseResponse([fakeGreenhouseJob()]));

      const result = await fetchGreenhouse(
        makeGreenhouseConfig({ name: 'Initech' }),
      );

      expect(result[0]?.company).toBe('Initech');
    });

    it('preserves the raw job fields in the raw property', async () => {
      const job = fakeGreenhouseJob({ title: 'Staff Engineer' });
      mockFetch(fakeGreenhouseResponse([job]));

      const result = await fetchGreenhouse(makeGreenhouseConfig());

      expect((result[0]?.raw as { title: string }).title).toBe(
        'Staff Engineer',
      );
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when the API returns no jobs', async () => {
      mockFetch(fakeGreenhouseResponse([]));

      const result = await fetchGreenhouse(makeGreenhouseConfig());

      expect(result).toHaveLength(0);
    });

    it('constructs the correct API URL including the content param', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(fakeGreenhouseResponse([])),
      } as Response);

      await fetchGreenhouse(makeGreenhouseConfig({ slug: 'my-company' }));

      expect(spy).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards/my-company/jobs?content=true',
      );
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the HTTP response is not OK', async () => {
      mockFetch({}, false, 404);

      await expect(fetchGreenhouse(makeGreenhouseConfig())).rejects.toThrow(
        'Greenhouse fetch failed for Acme Corp: 404',
      );
    });

    it('includes the company name in the error message', async () => {
      mockFetch({}, false, 500);

      await expect(
        fetchGreenhouse(makeGreenhouseConfig({ name: 'Globex' })),
      ).rejects.toThrow('Globex');
    });
  });
});
