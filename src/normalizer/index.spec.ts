import {
  fakeAshbyRawJob,
  fakeGreenhouseRawJob,
  fakeLeverRawJob,
  fakeWorkdayRawJob,
} from './factories/normalizer.factory.js';
import { normalize } from './index.js';

describe('normalize', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('greenhouse jobs', () => {
    it('maps id, title, location, url, and department', () => {
      const rawJob = fakeGreenhouseRawJob(
        {
          id: 123,
          title: 'Software Engineer',
          location: { name: 'New York, NY' },
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/123',
          departments: [{ name: 'Engineering' }],
        },
        'Acme Corp',
      );

      const [result] = normalize([rawJob]);

      expect(result).toMatchObject({
        id: 'greenhouse:acme-corp:123',
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'New York, NY',
        remote: false,
        url: 'https://boards.greenhouse.io/acme/jobs/123',
        department: 'Engineering',
        ats: 'greenhouse',
      });
    });

    it('sets remote: true when location contains "remote" (case-insensitive)', () => {
      const rawJob = fakeGreenhouseRawJob({
        location: { name: 'Remote - USA' },
      });

      const [result] = normalize([rawJob]);

      expect(result?.remote).toBe(true);
    });

    it('strips HTML tags from the description', () => {
      const rawJob = fakeGreenhouseRawJob({
        description: '<p>We are <strong>hiring</strong> engineers.</p>',
      });

      const [result] = normalize([rawJob]);

      expect(result?.descriptionText).toBe('We are hiring engineers.');
    });

    it('captures postedAt from updated_at when present', () => {
      const rawJob = fakeGreenhouseRawJob({
        updated_at: '2024-01-15T00:00:00Z',
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBe('2024-01-15T00:00:00Z');
    });
  });

  describe('lever jobs', () => {
    it('maps id, title, location, url, and department', () => {
      const rawJob = fakeLeverRawJob(
        {
          id: 'abc-def-123',
          text: 'Senior Software Engineer',
          hostedUrl: 'https://jobs.lever.co/acme/abc-def-123',
          categories: { location: 'Remote', team: 'Backend Engineering' },
        },
        'Acme Corp',
      );

      const [result] = normalize([rawJob]);

      expect(result).toMatchObject({
        id: 'lever:acme-corp:abc-def-123',
        title: 'Senior Software Engineer',
        location: 'Remote',
        remote: true,
        url: 'https://jobs.lever.co/acme/abc-def-123',
        department: 'Backend Engineering',
        ats: 'lever',
      });
    });

    it('converts createdAt epoch timestamp to ISO string', () => {
      const rawJob = fakeLeverRawJob({ createdAt: 1705276800000 });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBe(new Date(1705276800000).toISOString());
    });
  });

  describe('ashby jobs', () => {
    it('maps id, title, location, and url', () => {
      const rawJob = fakeAshbyRawJob(
        {
          id: 'ashby-123',
          title: 'Platform Engineer',
          locationName: 'Remote',
          jobUrl: 'https://jobs.ashbyhq.com/acme/ashby-123',
        },
        'Acme Corp',
      );

      const [result] = normalize([rawJob]);

      expect(result).toMatchObject({
        id: 'ashby:acme-corp:ashby-123',
        title: 'Platform Engineer',
        remote: true,
        ats: 'ashby',
      });
    });

    it('sets remote: true when workplaceType is "Remote"', () => {
      const rawJob = fakeAshbyRawJob({ workplaceType: 'Remote' });

      const [result] = normalize([rawJob]);

      expect(result?.remote).toBe(true);
    });
  });

  describe('workday jobs', () => {
    it('maps title and constructs url from __baseUrl and externalPath', () => {
      const rawJob = fakeWorkdayRawJob(
        {
          title: 'Software Engineer',
          externalPath: '/en-US/jobs/req123_abc',
          jobReqId: 'req123',
          locationsText: 'Remote',
          __baseUrl: 'https://acme.wd5.myworkdayjobs.com',
        },
        'Acme Corp',
      );

      const [result] = normalize([rawJob]);

      expect(result).toMatchObject({
        title: 'Software Engineer',
        company: 'Acme Corp',
        url: 'https://acme.wd5.myworkdayjobs.com/en-US/jobs/req123_abc',
        ats: 'workday',
      });
    });

    it('sets remote: true when locationsText contains "remote"', () => {
      const rawJob = fakeWorkdayRawJob({ locationsText: 'Remote, USA' });

      const [result] = normalize([rawJob]);

      expect(result?.remote).toBe(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = normalize([]);

      expect(result).toHaveLength(0);
    });

    it('drops jobs with no URL', () => {
      const rawJob = fakeGreenhouseRawJob({ absolute_url: '' });

      const result = normalize([rawJob]);

      expect(result).toHaveLength(0);
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('skips a malformed job without aborting the rest of the batch', () => {
      const malformedJob = fakeGreenhouseRawJob({ absolute_url: undefined });
      const validJob = fakeGreenhouseRawJob(
        {
          id: '99',
          title: 'Software Engineer',
          location: { name: 'Remote' },
          absolute_url: 'https://example.com/job',
        },
        'Acme Corp',
      );

      const result = normalize([malformedJob, validJob]);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('greenhouse:acme-corp:99');
    });
  });
});
