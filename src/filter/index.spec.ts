import { fakeNormalizedJob } from '../testing/factories/normalized-job.factory.js';
import { filter } from './index.js';

describe('filter', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('title allowlist', () => {
    it('passes jobs with an allowlisted title keyword', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Software Engineer' }),
      ]);

      expect(result).toHaveLength(1);
    });

    it('passes jobs matching "backend engineer"', () => {
      const result = filter([fakeNormalizedJob({ title: 'Backend Engineer' })]);

      expect(result).toHaveLength(1);
    });

    it('is case-insensitive for title matching', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'SOFTWARE ENGINEER' }),
      ]);

      expect(result).toHaveLength(1);
    });
  });

  describe('location filter', () => {
    it('passes remote jobs regardless of stated location', () => {
      const result = filter([
        fakeNormalizedJob({ location: 'Remote', remote: true }),
      ]);

      expect(result).toHaveLength(1);
    });

    it('passes jobs with "remote" in the location string', () => {
      const result = filter([
        fakeNormalizedJob({ location: 'Remote - US', remote: false }),
      ]);

      expect(result).toHaveLength(1);
    });

    it('passes jobs with no location set', () => {
      const result = filter([
        fakeNormalizedJob({ location: '', remote: false }),
      ]);

      expect(result).toHaveLength(1);
    });
  });

  describe('seniority blocklist', () => {
    it('passes senior-level roles (senior is not blocked)', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Senior Software Engineer' }),
      ]);

      expect(result).toHaveLength(1);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty array when input is empty', () => {
      const result = filter([]);

      expect(result).toHaveLength(0);
    });

    it('applies all filters independently — a job must pass every filter', () => {
      const jobs = [
        fakeNormalizedJob({
          title: 'Software Engineer',
          location: 'Remote',
          remote: true,
        }), // passes all
        fakeNormalizedJob({
          title: 'Junior Software Engineer',
          location: 'Remote',
          remote: true,
        }), // blocked: seniority
        fakeNormalizedJob({
          title: 'Software Engineer',
          location: 'London',
          remote: false,
        }), // blocked: location
        fakeNormalizedJob({
          title: 'Designer',
          location: 'Remote',
          remote: true,
        }), // blocked: title
      ];

      const result = filter(jobs);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Software Engineer');
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('filters out jobs with no title without throwing', () => {
      const result = filter([fakeNormalizedJob({ title: '' })]);

      expect(result).toHaveLength(0);
    });

    it('blocks junior roles', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Junior Software Engineer' }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks staff roles', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Staff Software Engineer' }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks frontend-focused roles', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Frontend Software Engineer' }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks mobile roles', () => {
      const result = filter([
        fakeNormalizedJob({ title: 'Mobile Software Engineer' }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks non-US international locations', () => {
      const result = filter([
        fakeNormalizedJob({
          title: 'Software Engineer',
          location: 'London, UK',
          remote: false,
        }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks India-based locations even when marked remote', () => {
      const result = filter([
        fakeNormalizedJob({ location: 'Bangalore, India', remote: true }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('blocks jobs with no allowlisted title keyword', () => {
      const result = filter([fakeNormalizedJob({ title: 'Product Designer' })]);

      expect(result).toHaveLength(0);
    });
  });
});
