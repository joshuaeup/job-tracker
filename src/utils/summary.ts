import type { RunSummary } from '../types/index.js';

/**
 * Prints a formatted pipeline run summary table to stdout.
 */
export const printSummary = (summary: RunSummary): void => {
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │         Pipeline Run Summary         │');
  console.log('  ├─────────────────────────────────────┤');
  console.log(`  │  Fetched        ${String(summary.fetched).padStart(20)} │`);
  console.log(`  │  Filtered       ${String(summary.filtered).padStart(20)} │`);
  console.log(
    `  │  New (deduped)  ${String(summary.deduplicated).padStart(20)} │`,
  );
  console.log(
    `  │  Sent to Slack  ${String(summary.deduplicated).padStart(20)} │`,
  );
  console.log('  └─────────────────────────────────────┘');
  console.log('');
};
