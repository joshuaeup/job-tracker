# Claude Instructions — Job Search Automation

This file defines the standards Claude must enforce in this repository. It takes precedence over general defaults.

---

## Project Overview

A TypeScript pipeline that runs daily via GitHub Actions:

1. **Fetch** — pull job postings from Ashby, Greenhouse, Lever, and Workday
2. **Normalize** — convert each ATS format to a common `NormalizedJob` schema
3. **Filter** — apply title allowlist, seniority blocklist, and location rules
4. **Deduplicate** — drop jobs already logged in the Notion tracker
5. **Log** — write new jobs to Notion
6. **Notify** — post a Slack digest for manual review

Entry point: `src/index.ts`. Runs as a compiled ESM Node app (`dist/index.js`).

---

## Source Layout

```
src/
  config/           # roles.json allowlist/blocklist; companies/ per-ATS configs
  fetchers/         # one subfolder per ATS (ashby, greenhouse, lever, workday)
  normalizer/       # maps raw ATS responses → NormalizedJob
  filter/           # title / seniority / location filtering
  dedup/            # drops jobs already in Notion
  logger/           # writes new jobs to Notion
  notify/           # posts Slack digest
  types/            # shared TypeScript types (AtsSource, RawJob, NormalizedJob, …)
  lib/              # createLogger
  utils/            # requireEnv, today, printSummary
  testing/          # shared factories (fakeNormalizedJob, fakeRawJob)
```

### Per-module folder structure

Every non-trivial module follows this layout. Do not deviate:

```
<module>/
  <module>.ts          # implementation
  <module>.spec.ts     # tests
  types.ts             # request/response types for this module (fetchers only)
  factories/           # fake data builders backed by @faker-js/faker
  mocks/               # mock helpers (mock clients, mockFetch, makeConfig, …)
```

---

## Code Style

### Arrow functions everywhere

All functions — exported or internal — use `const` arrow syntax:

```typescript
// correct
export const fetchAshby = async (config: CompanyConfig): Promise<RawJob[]> => {
  ...
};

// never
export async function fetchAshby(config: CompanyConfig): Promise<RawJob[]> {
  ...
}
```

### ESM imports

Always import with the `.js` extension (NodeNext module resolution):

```typescript
import { normalize } from './normalizer/index.js';
```

### Types

- Use `type` over `interface` for all data shapes.
- Explicit return types on all exported functions.
- Never use `any`. Use `unknown` for truly unknown input; cast with a type guard.
- No `// @ts-ignore` or `// @ts-nocheck`.

### Error handling

- Use `try/catch` with `error: unknown` in catch blocks.
- Log and continue for per-item failures (fetcher errors, Notion write failures).
- Throw and let `run()` catch fatal errors (missing env vars, etc.).

---

## Testing

### File naming

Test files are named `<module>.spec.ts` and live alongside their implementation.

### Spec structure — always in this order

```
success scenarios → edge cases → error states
```

Use section comments to separate them:

```typescript
// ── Success scenarios ──────────────────────────────────────────────────────
// ── Edge cases ─────────────────────────────────────────────────────────────
// ── Error states ───────────────────────────────────────────────────────────
```

### Factories

Every module that needs test data has a `factories/` folder with a `<module>.factory.ts` file. Factories:

- Accept `Partial<T>` overrides and spread them last.
- Use `@faker-js/faker` for all default values — never hardcode strings like `"test"`.
- Pin only the fields the test actually depends on; let everything else vary.

```typescript
export const fakeNormalizedJob = (overrides: Partial<NormalizedJob> = {}): NormalizedJob => ({
  title: 'Software Engineer',
  company: faker.company.name(),
  ...overrides,
});
```

### Mocks

Every module with external dependencies (Notion client, `fetch`, Slack webhook) has a `mocks/` folder. Mock helpers:

- Live in `mocks/<module>.mocks.ts`.
- Export named builder functions (`makeMockNotion`, `mockFetch`, `makeAshbyConfig`, …).
- Never inline mock setup directly in the spec — always import from `mocks/`.

### Jest / ESM

- Import `jest` explicitly: `import { jest } from '@jest/globals'`.
- Use `jest.spyOn(globalThis, 'fetch')` to mock the global fetch.
- Call `jest.restoreAllMocks()` in `beforeEach`, not `afterEach`.
- Cast Notion mock resolved values with `as never` when TypeScript complains about the generic return type.

---

## Adding a New ATS Integration

When adding support for a new ATS, create this full structure:

```
src/fetchers/<ats>/
  <ats>.ts                      # fetcher implementation
  <ats>.spec.ts                 # spec: URL construction, mapping, HTTP errors
  types.ts                      # AtsJob and AtsResponse types
  factories/<ats>.factory.ts    # fakeAtsJob, fakeAtsResponse
  mocks/<ats>.mocks.ts          # makeAtsConfig, mockFetch
```

Then register it in:
- `src/fetchers/index.ts` — add to the `FETCHERS` map
- `src/types/index.ts` — add the new ATS to the `AtsSource` union
- `src/normalizer/index.ts` — add a normalizer function and register it in `NORMALIZERS`
- `src/normalizer/factories/normalizer.factory.ts` — add a `fakeAtsRawJob` factory
- `src/config/companies/` — add a JSON file with `CompanyConfig[]` entries

---

## Environment Variables

Required at runtime (enforced via `requireEnv` — throws on startup if missing):

| Variable | Purpose |
|---|---|
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_DATABASE_ID` | ID of the job tracker database |
| `SLACK_WEBHOOK_URL` | Incoming webhook for the digest |

Never access `process.env` directly in business logic — always use `requireEnv`.

---

## What Claude Must Never Do

- Use `any` as a type.
- Use `function` keyword declarations — use `const` arrow functions.
- Write tests that only cover the happy path.
- Put mock setup or factory logic inline in a spec file — always extract to `mocks/` or `factories/`.
- Access `process.env` directly — use `requireEnv`.
- Add `// @ts-ignore` or `// @ts-nocheck`.
- Leave a `catch` block empty or with only a `console.log`.
- Create new modules without the full `factories/` + `mocks/` + `spec` structure.
- Import without the `.js` extension.
- Use `new Date()` directly in business logic — use the `today()` util.
