# Claude — TypeScript Standards

This file defines how Claude must write, structure, and test TypeScript code. These rules apply to every file in every session. Read fully before making any changes.

---

## Philosophy

- **Correctness over cleverness.** Code should be easy to read, easy to test, and hard to misuse.
- **Types are documentation.** Every annotation is a contract — write it with intention.
- **Fail loudly and early.** Catch errors at compile time wherever possible.
- **Tests tell the story.** A test suite should read like a specification.
- **Minimum necessary complexity.** Three similar lines is better than a premature abstraction. Don't design for hypothetical futures.

---

## TypeScript Configuration

### `tsconfig.json` baseline

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Why each strict flag matters

| Flag                                    | Effect                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `strict`                                | Enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and more |
| `noUncheckedIndexedAccess`              | Array/object index access returns `T \| undefined`, not `T`                  |
| `exactOptionalPropertyTypes`            | `{ foo?: string }` means absent or string, never explicitly `undefined`      |
| `noImplicitOverride`                    | Subclass overrides must use the `override` keyword                           |
| `isolatedModules`                       | Each file must be independently transpilable (required for esbuild/swc)      |
| `noUnusedLocals` / `noUnusedParameters` | Dead code is a compile error                                                 |

---

## Type System Rules

### Never use `any`

`any` disables the type checker. It is never acceptable.

| Instead of | Use                                       |
| ---------- | ----------------------------------------- |
| `any`      | `unknown` for truly unknown input         |
| `any[]`    | `unknown[]` or a typed array              |
| `object`   | `Record<string, unknown>`                 |
| `Function` | An explicit function signature            |
| `{}`       | `Record<string, unknown>` or a named type |

### Explicit return types on all exported functions

```typescript
// bad
export const getUser = (id: string) => db.find(id);

// good
export const getUser = (id: string): Promise<User | null> => db.find(id);
```

Inferred types are acceptable for private/internal implementation details only.

### `type` over `interface` for data shapes

Use `interface` only when you specifically need declaration merging or `implements`.

```typescript
// preferred — plain data shape
type User = {
  id: string;
  name: string;
  email: string;
};

// interface — only when implementing a contract
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
}
```

### Branded types for IDs and domain values

```typescript
type UserId = string & { readonly _brand: 'UserId' };
type OrderId = string & { readonly _brand: 'OrderId' };

const createUserId = (raw: string): UserId => raw as UserId;
```

Prevents passing a `UserId` where an `OrderId` is expected.

### Discriminated unions for state

```typescript
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

Always exhaustively handle every case. Use a `never` guard to catch unhandled branches at compile time:

```typescript
const assertNever = (value: never): never => {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
};
```

### `satisfies` for config objects

```typescript
const config = {
  port: 3000,
  host: 'localhost',
} satisfies ServerConfig;
```

Validates shape without widening the type — preserves literal types.

### Avoid `as` in business logic

Type assertions silence the compiler. If you find yourself writing `as SomeType`, restructure the code or write a type guard instead.

```typescript
// bad
const user = response.data as User;

// good
const isUser = (value: unknown): value is User =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof (value as Record<string, unknown>).id === 'string';
```

---

## Code Style

### Arrow functions — always

All functions, exported or internal, use `const` arrow syntax. Never use the `function` keyword.

```typescript
// correct
export const fetchJobs = async (config: Config): Promise<Job[]> => {
  const response = await fetch(config.url);
  return response.json() as Promise<Job[]>;
};

// never
export async function fetchJobs(config: Config): Promise<Job[]> { ... }
```

### ESM imports — always include `.js` extension

NodeNext module resolution requires the `.js` extension even for `.ts` source files.

```typescript
import { normalize } from './normalizer/index.js';
import type { NormalizedJob } from '../types/index.js';
```

### Import ordering

Use `simple-import-sort` or follow this order manually:

1. Node built-ins
2. Third-party packages
3. Internal absolute imports
4. Relative imports

Separate each group with a blank line. Type-only imports use `import type`.

### Naming conventions

| Construct             | Convention                       | Example                   |
| --------------------- | -------------------------------- | ------------------------- |
| Variables / functions | `camelCase`                      | `getUserById`             |
| Types / interfaces    | `PascalCase`                     | `UserRepository`          |
| Enums                 | Avoid — use discriminated unions | —                         |
| Constants             | `SCREAMING_SNAKE_CASE`           | `MAX_RETRY_COUNT`         |
| Generic params        | Descriptive                      | `TEntity`, `TResult`      |
| Files                 | `kebab-case`                     | `user-repository.ts`      |
| Spec files            | `<module>.spec.ts`               | `user-repository.spec.ts` |

Single-letter generics (`T`, `K`, `V`) are acceptable only for truly generic utility types.

### Function design

Prefer small, pure functions over methods with side effects. Name side-effectful functions to make the effect obvious.

```typescript
// pure transformation
const formatUserName = (user: User): string =>
  `${user.firstName} ${user.lastName}`.trim();

// side effect flagged in the name
const persistUserToDatabase = async (user: User): Promise<void> => {
  await db.users.insert(user);
};
```

Do not create wrapper functions that exist only to call one other function. Call the underlying function directly.

### Dates

Never use `new Date()` directly in business logic — it makes functions non-deterministic and untestable. Accept a date string as a parameter or inject a clock utility.

```typescript
// bad
const logEntry = () => ({ timestamp: new Date().toISOString() });

// good
const logEntry = (timestamp: string) => ({ timestamp });
```

### Environment variables

Never access `process.env` directly in business logic. Use a `requireEnv` helper that throws on startup if a variable is missing.

```typescript
export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
```

---

## Module & File Structure

### Source layout

```
src/
  types/        # shared TypeScript types — no runtime logic
  lib/          # low-level shared utilities (logger, http client, …)
  utils/        # pure helper functions (requireEnv, today, …)
  config/       # static configuration loaded at startup
  <feature>/    # one folder per feature or integration
  testing/      # shared test factories
  index.ts      # entry point — orchestrates the pipeline
```

### Per-module folder structure

Every non-trivial module follows this layout exactly:

```
<module>/
  <module>.ts          # implementation
  <module>.spec.ts     # tests — colocated with implementation
  types.ts             # types owned by this module (if needed)
  factories/
    <module>.factory.ts  # fake data builders using @faker-js/faker
  mocks/
    <module>.mocks.ts    # mock helpers (mock clients, mockFetch, makeConfig, …)
```

Never skip `factories/` or `mocks/` to save time — they prevent test-data sprawl and make specs readable.

### Exports

Each module controls its public API through a single entry point. Do not create barrel files that re-export everything indiscriminately.

```typescript
// src/user/index.ts
export type { User, UserId } from './user.types.js';
export { createUser } from './user.factory.js';
export { UserRepository } from './user-repository.js';
```

---

## Error Handling

### `Result` type for expected failures

Never throw for domain errors — return a typed result instead.

```typescript
type Result<T, E extends Error = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const divide = (a: number, b: number): Result<number, DivisionByZeroError> => {
  if (b === 0) return { success: false, error: new DivisionByZeroError() };
  return { success: true, data: a / b };
};
```

### Custom error classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" not found`, 'NOT_FOUND', {
      resource,
      id,
    });
  }
}
```

### `unknown` in catch blocks

Always type caught errors as `unknown`. Never assume the shape.

```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  if (error instanceof AppError) {
    logger.warn(error.message, { code: error.code });
  } else {
    logger.error('Unexpected error', { error });
    throw error;
  }
}
```

---

## Async Patterns

### `async/await` over Promise chains

```typescript
// bad
const loadUser = (id: string): Promise<User> =>
  fetchUser(id).then((raw) => parseUser(raw));

// good
const loadUser = async (id: string): Promise<User> => {
  const raw = await fetchUser(id);
  return parseUser(raw);
};
```

### Parallel operations

```typescript
// bad — sequential when they could be parallel
const user = await getUser(userId);
const orders = await getOrders(userId);

// good — parallel
const [user, orders] = await Promise.all([getUser(userId), getOrders(userId)]);
```

Every `Promise` must be `await`ed, returned, or explicitly handled with `.catch()`. Floating promises are a lint error.

---

## Documentation

### JSDoc for all exported symbols

Focus on **what it does**, any **special notes** (rate limits, side effects, format requirements), and **what it returns**. Do not restate the implementation or number the steps.

```typescript
/**
 * Fetches all job postings for a company from the Ashby public API.
 * Throws if the HTTP response is not OK — callers should catch and handle.
 *
 * @returns One RawJob per posting with source set to "ashby".
 */
export const fetchAshby = async (config: CompanyConfig): Promise<RawJob[]> => {
  ...
};
```

### Inline comments

Only add comments where the logic is non-obvious. Comments that restate the code add noise, not signal.

```typescript
// bad — restates the code
const filtered = jobs.filter((j) => !seen.has(j.url)); // filter out seen jobs

// good — explains the why
// Notion rate-limits writes to ~3 req/s; sleep between pages to stay under
await sleep(NOTION_RATE_DELAY_MS);
```

### Type documentation

Document non-obvious types with JSDoc. Use inline `/** */` comments for individual properties.

```typescript
/**
 * Represents a paginated list of results.
 * @template T - The type of items in the page
 */
type Page<T> = {
  /** The items in the current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Zero-based page index */
  page: number;
  /** Maximum items per page */
  pageSize: number;
};
```

---

## Testing

### File naming and location

Test files are named `<module>.spec.ts` and live **alongside their implementation** — not in a separate `__tests__` folder.

### Jest + ESM setup

```javascript
// jest.config.mjs
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

Run with: `NODE_OPTIONS=--experimental-vm-modules jest`

In spec files, import `jest` explicitly — do not rely on globals:

```typescript
import { jest } from '@jest/globals';
```

### Spec structure — always in this order

Every spec file follows this exact section order. Use the separator comments to make the structure scannable:

```typescript
describe('functionName', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the input is valid', () => {
    it('returns the expected result', () => { ... });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles an empty array without throwing', () => { ... });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the API returns a non-OK status', async () => { ... });
  });
});
```

### Factories

Every module that needs test data has a `factories/` folder. Factory rules:

- Accept `Partial<T>` overrides as the last argument and spread them last.
- Use `@faker-js/faker` for all defaults — never hardcode `"test"`, `"example"`, or `123`.
- Pin only the fields the test actually depends on; let everything else vary.
- Compose factories — call sub-factories rather than inlining nested objects.
- Name them `fake<Entity>` (e.g., `fakeUser`, `fakeNormalizedJob`).

```typescript
// src/testing/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import type { User } from '../../types/index.js';

/**
 * Builds a realistic User with randomised field values.
 * Pin individual fields via overrides when a test depends on a specific value.
 */
export const fakeUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  ...overrides,
});
```

**Compose, don't inline:**

```typescript
// bad — leaks internal structure into the test
const dto = fakeRequest({ user: { email: 'x@y.com', firstName: 'A', ... } });

// good — delegate to the sub-factory
const dto = fakeRequest({ user: fakeUser({ email: 'x@y.com' }) });
```

**Pin only what matters:**

```typescript
it('rejects when SSN is not 4 digits', async () => {
  const dto = fakeRequest({ user: fakeUser({ ssn: '12' }) });
  // everything else is randomised — test is focused on the one thing that matters
});
```

**Seed faker in CI** for reproducible failures:

```typescript
// jest.setup.ts
import { faker } from '@faker-js/faker';
beforeEach(() => {
  faker.seed(process.env['CI'] ? 12345 : Math.random() * 100_000);
});
```

### Mocks

Every module with external dependencies has a `mocks/` folder. Mock rules:

- Live in `mocks/<module>.mocks.ts`.
- Export named builder functions — `makeMockClient`, `mockFetch`, `makeConfig`.
- Never inline mock setup inside a spec file — always import from `mocks/`.
- Use `jest.spyOn(globalThis, 'fetch')` to stub the global `fetch`.
- Call `jest.restoreAllMocks()` in `beforeEach` — not `afterEach`.

```typescript
// mocks/slack.mocks.ts
import { jest } from '@jest/globals';

export const mockSlackFetch = (
  ok = true,
  status = 200,
): ReturnType<typeof jest.spyOn> =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
  } as Response);
```

```typescript
// mocks/notion.mocks.ts
import { jest } from '@jest/globals';
import type { Client } from '@notionhq/client';

export const makeMockNotion = (urls: string[]): Client =>
  ({
    databases: {
      query: jest.fn().mockResolvedValue({
        results: urls.map((url) => ({
          properties: { 'Job Posting URL': { type: 'url', url } },
        })),
        has_more: false,
        next_cursor: null,
      } as never),
    },
  }) as unknown as Client;
```

### Assertion style

Use the most specific matcher available.

```typescript
// bad
expect(result).toBeTruthy();
expect(arr.length).toBe(3);

// good
expect(result).toBeDefined();
expect(arr).toHaveLength(3);
expect(arr).toContainEqual(expect.objectContaining({ id: '123' }));
```

---

## Linting & Formatting

### ESLint rules (flat config)

```javascript
// eslint.config.mjs
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  'simple-import-sort/imports': 'error',
  'no-console': 'warn',
}
```

### Prettier

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 90,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

Always run `lint:fix` after writing new files before considering a task done.

---

## Git & Commit Hygiene

- One logical change per commit.
- Conventional commit format: `<type>(<scope>): <short description>`

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | New feature or capability                   |
| `fix`      | Bug fix                                     |
| `test`     | Adding or updating tests                    |
| `refactor` | Code restructuring with no behaviour change |
| `chore`    | Tooling, config, dependencies               |
| `docs`     | Documentation only                          |

Examples:

```
feat(auth): add JWT refresh token rotation
fix(normalizer): handle null location in Lever response
test(dedup): cover pagination edge case
refactor(fetchers): extract shared mockFetch to mocks folder
```

Never commit `TODO` comments without a linked issue reference.

---

## Hard Rules — Never Do These

- Use `any` as a type.
- Use the `function` keyword — always use `const` arrow functions.
- Write a test that only covers the happy path.
- Inline factory or mock setup inside a spec — extract to `factories/` or `mocks/`.
- Access `process.env` directly in business logic — use `requireEnv`.
- Add `// @ts-ignore` or `// @ts-nocheck`.
- Leave a `catch` block empty or with only a `console.log`.
- Create a module without a colocated spec file.
- Create a module with external dependencies without a `mocks/` folder.
- Create a module that needs test data without a `factories/` folder.
- Import without the `.js` extension in ESM projects.
- Use `new Date()` directly in business logic — inject a date or use a utility.
- Write wrapper functions that do nothing but call one other function.
- Add error handling, fallbacks, or validation for scenarios that cannot happen.
- Add docstrings, comments, or type annotations to code you did not change.
- Create helpers or abstractions for one-time operations.
