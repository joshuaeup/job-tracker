import { parseSalaryFromText } from './salary-parser.js';

describe('parseSalaryFromText', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when a salary range is present', () => {
    it('parses a standard range with en dash', () => {
      expect(
        parseSalaryFromText('Salary: $120,000 – $150,000 per year'),
      ).toEqual({ min: 120_000, max: 150_000 });
    });

    it('parses a range with a hyphen separator', () => {
      expect(parseSalaryFromText('Pay: $80,000 - $100,000')).toEqual({
        min: 80_000,
        max: 100_000,
      });
    });

    it('parses a range with "to" as the separator', () => {
      expect(parseSalaryFromText('$90,000 to $130,000 annually')).toEqual({
        min: 90_000,
        max: 130_000,
      });
    });

    it('parses k-suffix shorthand on both sides', () => {
      expect(parseSalaryFromText('Compensation: $120k - $160k')).toEqual({
        min: 120_000,
        max: 160_000,
      });
    });

    it('parses mixed k-suffix (only one side)', () => {
      expect(parseSalaryFromText('$120k – $150,000')).toEqual({
        min: 120_000,
        max: 150_000,
      });
    });

    it('parses a range where the dash was an HTML &mdash; entity', () => {
      expect(parseSalaryFromText('Pay Range $165,000—$180,000 USD')).toEqual({
        min: 165_000,
        max: 180_000,
      });
    });

    it('parses when the second dollar sign is omitted', () => {
      expect(parseSalaryFromText('$120,000 - 150,000')).toEqual({
        min: 120_000,
        max: 150_000,
      });
    });

    it('parses a range with decimal amounts', () => {
      expect(
        parseSalaryFromText(
          'The base pay range is $160,900.00 - $257,100.00 annually.',
        ),
      ).toEqual({ min: 160_900, max: 257_100 });
    });

    it('finds the range even when surrounded by HTML-stripped prose', () => {
      const text =
        'We offer competitive pay. The range for this role is $95,000 – $125,000. Benefits include…';
      expect(parseSalaryFromText(text)).toEqual({ min: 95_000, max: 125_000 });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for both fields when no salary appears', () => {
      expect(
        parseSalaryFromText('Great opportunity to join our team.'),
      ).toEqual({ min: null, max: null });
    });

    it('returns null when the range is an hourly rate (below minimum)', () => {
      expect(parseSalaryFromText('$25 - $35 per hour')).toEqual({
        min: null,
        max: null,
      });
    });

    it('returns null when min equals max', () => {
      expect(parseSalaryFromText('$100,000 - $100,000')).toEqual({
        min: null,
        max: null,
      });
    });

    it('returns null when min exceeds max', () => {
      expect(parseSalaryFromText('$150,000 - $100,000')).toEqual({
        min: null,
        max: null,
      });
    });

    it('returns null for an empty string', () => {
      expect(parseSalaryFromText('')).toEqual({ min: null, max: null });
    });
  });
});
