import { jest } from '@jest/globals';

import { fakeNormalizedJob } from '../testing/factories/normalized-job.factory.js';
import { enrich } from './enricher.js';
import {
  mockWorkdayDetail,
  mockWorkdayDetailFailure,
  mockWorkdayDetailNetworkError,
} from './mocks/enricher.mocks.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('enrich', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when jobs have descriptions from the ATS list response', () => {
    it('parses salary from the existing description text', async () => {
      const job = fakeNormalizedJob({
        ats: 'greenhouse',
        descriptionText: 'Compensation: $120,000 – $150,000 per year.',
        salaryMin: null,
        salaryMax: null,
      });

      const [result] = await enrich([job]);

      expect(result?.salaryMin).toBe(120_000);
      expect(result?.salaryMax).toBe(150_000);
    });

    it('does not overwrite salary already set by the ATS', async () => {
      const job = fakeNormalizedJob({
        ats: 'greenhouse',
        descriptionText: 'Compensation: $120,000 – $150,000 per year.',
        salaryMin: 90_000,
        salaryMax: 110_000,
      });

      const [result] = await enrich([job]);

      expect(result?.salaryMin).toBe(90_000);
      expect(result?.salaryMax).toBe(110_000);
    });

    it('leaves salary null when no range appears in the description', async () => {
      const job = fakeNormalizedJob({
        ats: 'lever',
        descriptionText: 'Great opportunity with competitive pay.',
        salaryMin: null,
        salaryMax: null,
      });

      const [result] = await enrich([job]);

      expect(result?.salaryMin).toBeNull();
      expect(result?.salaryMax).toBeNull();
    });
  });

  describe('when a Workday job is enriched', () => {
    it('fetches the description from the CXS detail endpoint', async () => {
      mockWorkdayDetail('<p>We offer $130,000 – $160,000 annually.</p>');

      const job = fakeNormalizedJob({
        ats: 'workday',
        url: 'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Engineer_123',
        descriptionText: '',
        salaryMin: null,
        salaryMax: null,
      });

      const [result] = await enrich([job]);

      expect(result?.descriptionText).toContain('$130,000');
      expect(result?.salaryMin).toBe(130_000);
      expect(result?.salaryMax).toBe(160_000);
    });

    it('calls the CXS endpoint derived from the job URL', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobPostingInfo: { jobDescription: '' } }),
      } as Response);

      const job = fakeNormalizedJob({
        ats: 'workday',
        url: 'https://vanguard.wd5.myworkdayjobs.com/en-US/vanguard_external/job/Charlotte-NC/Engineer_177694',
      });

      await enrich([job]);

      expect(spy).toHaveBeenCalledWith(
        'https://vanguard.wd5.myworkdayjobs.com/wday/cxs/vanguard/vanguard_external/job/Charlotte-NC/Engineer_177694',
      );
    });

    it('strips HTML tags from the fetched description', async () => {
      mockWorkdayDetail(
        '<p><b>Role:</b> Build great things.</p><ul><li>Item</li></ul>',
      );

      const job = fakeNormalizedJob({ ats: 'workday', descriptionText: '' });

      const [result] = await enrich([job]);

      expect(result?.descriptionText).not.toContain('<');
      expect(result?.descriptionText).toContain('Build great things');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when given no jobs', async () => {
      expect(await enrich([])).toEqual([]);
    });

    it('preserves all other job fields unchanged', async () => {
      const job = fakeNormalizedJob({ ats: 'ashby', descriptionText: '' });

      const [result] = await enrich([job]);

      expect(result?.id).toBe(job.id);
      expect(result?.title).toBe(job.title);
      expect(result?.url).toBe(job.url);
      expect(result?.company).toBe(job.company);
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('returns the job unchanged when the Workday detail fetch fails', async () => {
      mockWorkdayDetailFailure(500);

      const job = fakeNormalizedJob({
        ats: 'workday',
        descriptionText: '',
        salaryMin: null,
        salaryMax: null,
      });

      const [result] = await enrich([job]);

      expect(result?.descriptionText).toBe('');
      expect(result?.salaryMin).toBeNull();
      expect(result?.salaryMax).toBeNull();
    });

    it('keeps the job unchanged when the Workday fetch throws a network error', async () => {
      mockWorkdayDetailNetworkError();

      const job = fakeNormalizedJob({
        ats: 'workday',
        descriptionText: '',
        salaryMin: null,
        salaryMax: null,
      });

      const [result] = await enrich([job]);

      expect(result?.descriptionText).toBe('');
      expect(result?.salaryMin).toBeNull();
    });

    it('continues enriching remaining jobs after a single Workday fetch failure', async () => {
      mockWorkdayDetailFailure(503);
      mockWorkdayDetail('<p>Pay: $100,000 – $130,000</p>');

      const failing = fakeNormalizedJob({
        ats: 'workday',
        descriptionText: '',
      });
      const succeeding = fakeNormalizedJob({
        ats: 'workday',
        url: 'https://acme.wd5.myworkdayjobs.com/en-US/acme_jobs/job/Remote/Eng_1',
        descriptionText: '',
        salaryMin: null,
        salaryMax: null,
      });

      const results = await enrich([failing, succeeding]);

      expect(results[0]?.salaryMin).toBeNull();
      expect(results[1]?.salaryMin).toBe(100_000);
    });
  });
});
