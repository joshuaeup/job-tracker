import { jest } from '@jest/globals';

import { fakeNormalizedJob } from '../testing/factories/normalized-job.factory.js';
import { mockSlackFetch } from './mocks/slack.mocks.js';
import { sendReviewDigest } from './slack.js';

const WEBHOOK_URL = 'https://hooks.slack.com/test';
const DATE = '2024-01-15';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('sendReviewDigest', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the webhook succeeds', () => {
    it('posts to the webhook URL via POST', async () => {
      const spy = mockSlackFetch();

      await sendReviewDigest(WEBHOOK_URL, DATE, []);

      expect(spy).toHaveBeenCalledWith(
        WEBHOOK_URL,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('sends "no roles found" message when jobs list is empty', async () => {
      const spy = mockSlackFetch();

      await sendReviewDigest(WEBHOOK_URL, DATE, []);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('No new roles found');
    });

    it('includes the job title and company in the message when jobs are present', async () => {
      const spy = mockSlackFetch();
      const job = fakeNormalizedJob({
        title: 'Platform Engineer',
        company: 'Acme Corp',
      });

      await sendReviewDigest(WEBHOOK_URL, DATE, [job]);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('Acme Corp');
      expect(body.text).toContain('Platform Engineer');
    });

    it('includes the date in the message header', async () => {
      const spy = mockSlackFetch();

      await sendReviewDigest(WEBHOOK_URL, '2024-06-01', []);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('2024-06-01');
    });

    it('includes the job count when multiple jobs are present', async () => {
      const spy = mockSlackFetch();
      const jobs = [
        fakeNormalizedJob(),
        fakeNormalizedJob(),
        fakeNormalizedJob(),
      ];

      await sendReviewDigest(WEBHOOK_URL, DATE, jobs);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('3');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('formats salary range when both min and max are present', async () => {
      const spy = mockSlackFetch();
      const job = fakeNormalizedJob({ salaryMin: 120000, salaryMax: 180000 });

      await sendReviewDigest(WEBHOOK_URL, DATE, [job]);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('120,000');
      expect(body.text).toContain('180,000');
    });

    it('shows "Not listed" when no salary data is available', async () => {
      const spy = mockSlackFetch();
      const job = fakeNormalizedJob({ salaryMin: null, salaryMax: null });

      await sendReviewDigest(WEBHOOK_URL, DATE, [job]);

      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text).toContain('Not listed');
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the webhook returns a non-OK status', async () => {
      mockSlackFetch(false, 400);

      await expect(sendReviewDigest(WEBHOOK_URL, DATE, [])).rejects.toThrow(
        'Slack webhook failed',
      );
    });

    it('includes the status code in the error message', async () => {
      mockSlackFetch(false, 503);

      await expect(sendReviewDigest(WEBHOOK_URL, DATE, [])).rejects.toThrow(
        '503',
      );
    });
  });
});
