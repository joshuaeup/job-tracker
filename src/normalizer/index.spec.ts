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

    it('strips HTML tags from the description field', () => {
      const rawJob = fakeGreenhouseRawJob({
        description: '<p>We are <strong>hiring</strong> engineers.</p>',
      });

      const [result] = normalize([rawJob]);

      expect(result?.descriptionText).toBe('We are hiring engineers.');
    });

    it('reads description from the content field when description is absent', () => {
      const rawJob = fakeGreenhouseRawJob({
        content: '<p>The salary range is $120,000 - $150,000.</p>',
      });

      const [result] = normalize([rawJob]);

      expect(result?.descriptionText).toContain('$120,000 - $150,000');
    });

    it('parses salary from currency_range metadata when present', () => {
      const rawJob = fakeGreenhouseRawJob({
        metadata: [
          {
            value_type: 'currency_range',
            value: { min_value: '120000', max_value: '160000' },
          },
        ],
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBe(120_000);
      expect(result?.salaryMax).toBe(160_000);
    });

    it('returns null salary when metadata has no currency_range entry', () => {
      const rawJob = fakeGreenhouseRawJob({
        metadata: [{ value_type: 'text', value: 'some text' }],
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
    });

    it('returns null salary when currency_range values are not strings', () => {
      const rawJob = fakeGreenhouseRawJob({
        metadata: [
          {
            value_type: 'currency_range',
            value: { min_value: 120_000, max_value: 160_000 },
          },
        ],
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
    });

    it('returns null salary when currency_range values are unparseable strings', () => {
      const rawJob = fakeGreenhouseRawJob({
        metadata: [
          {
            value_type: 'currency_range',
            value: { min_value: 'TBD', max_value: 'TBD' },
          },
        ],
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
    });

    it('captures postedAt from updated_at when present', () => {
      const rawJob = fakeGreenhouseRawJob({
        updated_at: '2024-01-15T00:00:00Z',
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBe('2024-01-15T00:00:00Z');
    });

    it('falls back to first_published when updated_at is absent', () => {
      const rawJob = fakeGreenhouseRawJob({
        updated_at: undefined,
        first_published: '2024-03-01T00:00:00Z',
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBe('2024-03-01T00:00:00Z');
    });

    it('sets postedAt to null when both updated_at and first_published are absent', () => {
      const rawJob = fakeGreenhouseRawJob({
        updated_at: undefined,
        first_published: undefined,
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBeNull();
    });

    it('reads description from content.description when content is an object', () => {
      const rawJob = fakeGreenhouseRawJob({
        content: { description: '<p>Pay range: $100,000–$120,000</p>' },
      });

      const [result] = normalize([rawJob]);

      expect(result?.descriptionText).toContain('$100,000');
    });

    it('sets empty description when neither description nor content is set', () => {
      const rawJob = fakeGreenhouseRawJob({
        description: undefined,
        content: undefined,
      });

      const [result] = normalize([rawJob]);

      expect(result?.descriptionText).toBe('');
    });

    it('sets empty department when departments array is empty', () => {
      const rawJob = fakeGreenhouseRawJob({ departments: [] });

      const [result] = normalize([rawJob]);

      expect(result?.department).toBe('');
    });

    it('sets empty department when departments is not an array', () => {
      const rawJob = fakeGreenhouseRawJob({ departments: null });

      const [result] = normalize([rawJob]);

      expect(result?.department).toBe('');
    });
  });

  describe('lever jobs', () => {
    it('parses salary from salaryRange when present', () => {
      const rawJob = fakeLeverRawJob({
        salaryRange: { minValue: 100_000, maxValue: 150_000 },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBe(100_000);
      expect(result?.salaryMax).toBe(150_000);
    });

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

    it('sets postedAt to null when createdAt is absent', () => {
      const rawJob = fakeLeverRawJob({ createdAt: undefined });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBeNull();
    });

    it('sets empty location and department when categories is absent', () => {
      const rawJob = fakeLeverRawJob({ categories: undefined });

      const [result] = normalize([rawJob]);

      expect(result?.location).toBe('');
      expect(result?.department).toBe('');
    });

    it('falls back to allLocations when location is absent from categories', () => {
      const rawJob = fakeLeverRawJob({
        categories: { allLocations: 'Remote - US', team: 'Engineering' },
      });

      const [result] = normalize([rawJob]);

      expect(result?.location).toBe('Remote - US');
    });

    it('falls back to department when team is absent from categories', () => {
      const rawJob = fakeLeverRawJob({
        categories: { location: 'Remote', department: 'Product Engineering' },
      });

      const [result] = normalize([rawJob]);

      expect(result?.department).toBe('Product Engineering');
    });

    it('returns null salary when compensation values are not numbers', () => {
      const rawJob = fakeLeverRawJob({
        salaryRange: { minValue: 'TBD', maxValue: 'TBD' },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
      expect(result?.salaryMax).toBeNull();
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

    it('parses salary from the summaryComponents compensation field', () => {
      const rawJob = fakeAshbyRawJob({
        compensation: {
          summaryComponents: [
            {
              compensationType: 'EquityPercentage',
              interval: 'NONE',
              currencyCode: null,
              minValue: null,
              maxValue: null,
            },
            {
              compensationType: 'Salary',
              interval: '1 YEAR',
              currencyCode: 'USD',
              minValue: 127_000,
              maxValue: 207_000,
            },
          ],
        },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBe(127_000);
      expect(result?.salaryMax).toBe(207_000);
    });

    it('returns null salary when compensation is absent', () => {
      const rawJob = fakeAshbyRawJob({ compensation: null });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
      expect(result?.salaryMax).toBeNull();
    });

    it('returns null salary when summaryComponents is not an array', () => {
      const rawJob = fakeAshbyRawJob({
        compensation: { summaryComponents: null },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
    });

    it('returns null salary when no Salary component exists in summaryComponents', () => {
      const rawJob = fakeAshbyRawJob({
        compensation: {
          summaryComponents: [
            {
              compensationType: 'EquityPercentage',
              interval: 'NONE',
              minValue: null,
              maxValue: null,
            },
          ],
        },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
    });

    it('returns null salary when the Salary component has non-number min/max values', () => {
      const rawJob = fakeAshbyRawJob({
        compensation: {
          summaryComponents: [
            {
              compensationType: 'Salary',
              interval: '1 YEAR',
              minValue: null,
              maxValue: null,
            },
          ],
        },
      });

      const [result] = normalize([rawJob]);

      expect(result?.salaryMin).toBeNull();
      expect(result?.salaryMax).toBeNull();
    });

    it('falls back to applyUrl when jobUrl is absent', () => {
      const rawJob = fakeAshbyRawJob({
        jobUrl: undefined,
        applyUrl: 'https://jobs.ashbyhq.com/acme/apply/123',
      });

      const [result] = normalize([rawJob]);

      expect(result?.url).toBe('https://jobs.ashbyhq.com/acme/apply/123');
    });

    it('falls back to department when departmentName is absent', () => {
      const rawJob = fakeAshbyRawJob({
        departmentName: undefined,
        department: 'Platform Engineering',
      });

      const [result] = normalize([rawJob]);

      expect(result?.department).toBe('Platform Engineering');
    });

    it('falls back to createdAt when publishedAt is absent', () => {
      const rawJob = fakeAshbyRawJob({
        publishedAt: undefined,
        createdAt: '2024-05-01T00:00:00Z',
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBe('2024-05-01T00:00:00Z');
    });

    it('sets postedAt to null when both publishedAt and createdAt are absent', () => {
      const rawJob = fakeAshbyRawJob({
        publishedAt: undefined,
        createdAt: undefined,
      });

      const [result] = normalize([rawJob]);

      expect(result?.postedAt).toBeNull();
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

    it('extracts id from externalPath when jobReqId is absent', () => {
      const rawJob = fakeWorkdayRawJob({
        jobReqId: undefined,
        externalPath: '/en-US/jobs/SoftwareEngineer_req456',
        __baseUrl: 'https://acme.wd5.myworkdayjobs.com',
      });

      const [result] = normalize([rawJob]);

      expect(result?.id).toContain('req456');
    });

    it('uses bulletFields[0] as id fallback when jobReqId is absent', () => {
      const rawJob = fakeWorkdayRawJob({
        jobReqId: undefined,
        'bulletFields[0]': 'REQ-789',
        externalPath: '/en-US/jobs/SomeRole_noid',
        __baseUrl: 'https://acme.wd5.myworkdayjobs.com',
      });

      const [result] = normalize([rawJob]);

      expect(result?.id).toContain('REQ-789');
    });

    it('drops the job when externalPath is absent', () => {
      const rawJob = fakeWorkdayRawJob({
        externalPath: '',
        jobReqId: 'req123',
        __baseUrl: 'https://acme.wd5.myworkdayjobs.com',
      });

      const result = normalize([rawJob]);

      expect(result).toHaveLength(0);
    });

    it('uses empty string as baseUrl when __baseUrl is absent', () => {
      const rawJob = fakeWorkdayRawJob({
        jobReqId: 'req999',
        externalPath: '/en-US/jobs/Role_req999',
        __baseUrl: undefined,
      });

      const [result] = normalize([rawJob]);

      expect(result?.url).toBe('/en-US/jobs/Role_req999');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty location string when location is neither a string nor a named record', () => {
      const rawJob = fakeAshbyRawJob({ locationName: 42 });

      const [result] = normalize([rawJob]);

      expect(result?.location).toBe('');
    });

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
