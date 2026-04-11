# CLAUDE.md — TypeScript Project Guidelines

This file defines how Claude should understand, write, and maintain code in this repository. Read it fully before making any changes.

---

## Project Philosophy

- Correctness over cleverness. Code should be easy to read, easy to test, and hard to misuse.
- Types are documentation. Every type annotation is a contract — write it with intention.
- Fail loudly and early. Errors should be caught at compile time wherever possible.
- Tests tell the story. A test suite should read like a specification.

---

## TypeScript Configuration

Target: **ES2022+** with `"moduleResolution": "bundler"` or `"node16"`.

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

### Key flags and why they matter

- `strict` — enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and more.
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`, not `T`.
- `exactOptionalPropertyTypes` — `{ foo?: string }` means `foo` is absent or a string, never explicitly `undefined`.
- `noImplicitOverride` — subclass method overrides must use the `override` keyword.
- `isolatedModules` — each file must be independently transpilable (required for esbuild/swc compatibility).

---

## Type System Rules

### Never use `any`

`any` turns off the type checker entirely. It is never acceptable. Use these alternatives:

| Instead of       | Use                                      |
|------------------|------------------------------------------|
| `any`            | `unknown` for truly unknown input        |
| `any[]`          | `unknown[]` or a typed array             |
| `object`         | `Record<string, unknown>`                |
| `Function`       | An explicit function signature           |
| `{}`             | `Record<string, unknown>` or a named type |

### Explicit types where it matters

Return types on exported functions must always be explicit:

```typescript
// Bad
export function getUser(id: string) {
  return db.find(id);
}

// Good
export function getUser(id: string): Promise<User | null> {
  return db.find(id);
}
```

Inferred types are acceptable for internal/private implementation details, but never for public API surfaces.

### Prefer `type` over `interface` for data shapes

Use `interface` only when you specifically need declaration merging or `implements`.

```typescript
// Preferred for plain data
type User = {
  id: string;
  name: string;
  email: string;
};

// Use interface only when implementing a contract
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
}
```

### Branded / opaque types for IDs and domain values

```typescript
type UserId = string & { readonly _brand: "UserId" };
type OrderId = string & { readonly _brand: "OrderId" };

function createUserId(raw: string): UserId {
  return raw as UserId;
}
```

This prevents accidentally passing a `UserId` where an `OrderId` is expected.

### Use discriminated unions for state

```typescript
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

Always exhaustively handle discriminated unions. Use a `never` assertion to ensure completeness:

```typescript
function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
```

### Use `satisfies` for config objects

```typescript
const config = {
  port: 3000,
  host: "localhost",
} satisfies ServerConfig;
```

This validates the shape without widening the type, preserving literal types.

### Avoid type assertions (`as`) in business logic

Type assertions silence the compiler. If you find yourself writing `as SomeType`, it usually means the code needs to be restructured or a proper type guard written.

```typescript
// Bad
const user = response.data as User;

// Good
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as Record<string, unknown>).id === "string"
  );
}
```

---

## Naming Conventions

| Construct           | Convention            | Example                        |
|---------------------|-----------------------|--------------------------------|
| Variables/functions | `camelCase`           | `getUserById`                  |
| Types/Interfaces    | `PascalCase`          | `UserRepository`               |
| Enums               | `PascalCase` (avoid)  | Prefer discriminated unions    |
| Constants           | `SCREAMING_SNAKE_CASE`| `MAX_RETRY_COUNT`              |
| Generic params      | Descriptive names     | `TEntity`, `TResult`, `TInput` |
| Files               | `kebab-case`          | `user-repository.ts`           |
| Test files          | `*.test.ts`           | `user-repository.test.ts`      |

Single-letter generics (`T`, `K`, `V`) are acceptable only for truly generic utility types.

---

## Code Structure

### Module organization

```
src/
  domain/         # Pure types and business logic — no framework deps
  application/    # Use cases / service layer
  infrastructure/ # DB, HTTP clients, external services
  lib/            # Shared utilities and helpers
  index.ts        # Public API surface
```

### Exports

Each module should have a single entry point that explicitly controls its public API:

```typescript
// src/domain/user/index.ts
export type { User, UserId } from "./user.types.ts";
export { createUser } from "./user.factory.ts";
export { UserRepository } from "./user-repository.ts";
```

Avoid barrel re-exports that unintentionally expose internals.

### Function design

Prefer small, pure functions over methods with side effects:

```typescript
// Prefer pure transformation
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

// Flag side effects clearly by name
async function persistUserToDatabase(user: User): Promise<void> {
  await db.users.insert(user);
}
```

---

## Error Handling

### Use typed `Result` pattern for expected failures

Never throw for domain errors. Return a typed result:

```typescript
type Result<T, E extends Error = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function divide(a: number, b: number): Result<number, DivisionByZeroError> {
  if (b === 0) {
    return { success: false, error: new DivisionByZeroError() };
  }
  return { success: true, data: a / b };
}
```

### Custom error classes

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" was not found`, "NOT_FOUND", {
      resource,
      id,
    });
  }
}
```

### `unknown` in catch blocks

Always treat caught errors as `unknown`:

```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  if (error instanceof AppError) {
    logger.warn(error.message, { code: error.code });
  } else {
    logger.error("Unexpected error", { error });
    throw error; // Re-throw truly unexpected errors
  }
}
```

---

## Async Patterns

### Always use `async/await` over raw Promise chains

```typescript
// Bad
function loadUser(id: string): Promise<User> {
  return fetchUser(id).then((raw) => parseUser(raw));
}

// Good
async function loadUser(id: string): Promise<User> {
  const raw = await fetchUser(id);
  return parseUser(raw);
}
```

### Parallel async operations

```typescript
// Bad — sequential when they could be parallel
const user = await getUser(userId);
const orders = await getOrders(userId);

// Good — parallel
const [user, orders] = await Promise.all([
  getUser(userId),
  getOrders(userId),
]);
```

### Avoid unhandled promise rejections

Every `Promise` must be either `await`ed, returned, or explicitly handled with `.catch()`.

---

## Documentation

### JSDoc for exported symbols

All exported functions, types, and classes must have JSDoc comments:

```typescript
/**
 * Retrieves a user by their unique identifier.
 *
 * @param id - The user's unique ID (branded UserId)
 * @returns The user if found, or `null` if no user exists with that ID
 * @throws {DatabaseError} If the database query fails
 *
 * @example
 * ```typescript
 * const user = await getUserById(createUserId("abc-123"));
 * if (user) {
 *   console.log(user.name);
 * }
 * ```
 */
export async function getUserById(id: UserId): Promise<User | null> {
  // ...
}
```

### Type documentation

Document non-obvious types:

```typescript
/**
 * Represents a paginated list of results.
 *
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

## Testing with Jest

### Setup

```bash
npm install --save-dev jest ts-jest @types/jest
```

```json
// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};

export default config;
```

### Test file structure

Tests follow a strict order: **success scenarios → edge cases → error states**. This mirrors how real-world usage unfolds: the happy path first, then boundaries, then failures.

```typescript
describe("getUserById", () => {
  // -----------------------------------------------
  // SUCCESS SCENARIOS — the happy path
  // -----------------------------------------------
  describe("when the user exists", () => {
    it("returns the user with all fields populated", async () => {
      const userId = createUserId("user-1");
      mockDb.users.findOne.mockResolvedValue(buildUser({ id: userId }));

      const result = await getUserById(userId);

      expect(result).toEqual(
        expect.objectContaining({
          id: userId,
          name: expect.any(String),
          email: expect.any(String),
        })
      );
    });

    it("returns the user regardless of email casing stored in db", async () => {
      const userId = createUserId("user-2");
      mockDb.users.findOne.mockResolvedValue(
        buildUser({ id: userId, email: "USER@EXAMPLE.COM" })
      );

      const result = await getUserById(userId);

      expect(result?.email).toBe("user@example.com");
    });
  });

  // -----------------------------------------------
  // EDGE CASES — boundaries and unusual-but-valid inputs
  // -----------------------------------------------
  describe("edge cases", () => {
    it("returns null when no user is found", async () => {
      mockDb.users.findOne.mockResolvedValue(null);

      const result = await getUserById(createUserId("nonexistent"));

      expect(result).toBeNull();
    });

    it("handles a user with no optional fields set", async () => {
      const userId = createUserId("minimal");
      mockDb.users.findOne.mockResolvedValue(
        buildUser({ id: userId, bio: undefined, avatarUrl: undefined })
      );

      const result = await getUserById(userId);

      expect(result?.bio).toBeUndefined();
      expect(result?.avatarUrl).toBeUndefined();
    });
  });

  // -----------------------------------------------
  // ERROR STATES — thrown errors and failure modes
  // -----------------------------------------------
  describe("error handling", () => {
    it("throws a DatabaseError when the query fails", async () => {
      mockDb.users.findOne.mockRejectedValue(new Error("Connection timeout"));

      await expect(getUserById(createUserId("user-1"))).rejects.toThrow(
        DatabaseError
      );
    });

    it("includes the original error message in the DatabaseError context", async () => {
      const cause = new Error("Connection timeout");
      mockDb.users.findOne.mockRejectedValue(cause);

      await expect(getUserById(createUserId("user-1"))).rejects.toMatchObject({
        code: "DATABASE_ERROR",
        context: expect.objectContaining({ cause: "Connection timeout" }),
      });
    });
  });
});
```

### Test factories / builders

Never construct test data inline. Use factory functions backed by `@faker-js/faker` for realistic, randomised data. This catches bugs that hardcoded strings like `"test@example.com"` never would.

```bash
npm install --save-dev @faker-js/faker
```

Each factory accepts `Partial<T>` overrides so callers can pin only the fields that matter to a given test, letting everything else vary naturally:

```typescript
// src/testing/factories/user.factory.ts
import { faker } from "@faker-js/faker";
import type { User } from "../../domain/user/user.types.ts";
import type { Consent } from "../../domain/consent/consent.types.ts";
import type { ExternalIds } from "../../domain/external-ids/external-ids.types.ts";
import type { CheckInRequestDto } from "../../dto/check-in-request.dto.ts";

/**
 * Builds a realistic User object with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 *
 * @example
 * const user = fakeUser({ email: "fixed@example.com" });
 */
export const fakeUser = (overrides: Partial<User> = {}): User => ({
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  streetAddress1: faker.location.streetAddress(),
  streetAddress2: faker.location.secondaryAddress(),
  city: faker.location.city(),
  state: faker.location.state(),
  zip: faker.location.zipCode(),
  ssn: faker.string.numeric(4),
  ...overrides,
});

export const fakeConsent = (overrides: Partial<Consent> = {}): Consent => ({
  softCreditCheck: faker.datatype.boolean(),
  ...overrides,
});

export const fakeExternalIds = (
  overrides: Partial<ExternalIds> = {},
): ExternalIds => ({
  accountAuthId: faker.string.uuid(),
  emailUserId: faker.string.uuid(),
  ...overrides,
});

/**
 * Composes all sub-factories into a full CheckInRequestDto.
 * Override nested objects at any depth:
 *
 * @example
 * const dto = fakeCheckInRequest({ user: fakeUser({ ssn: "1234" }) });
 */
export const fakeCheckInRequest = (
  overrides: Partial<CheckInRequestDto> = {},
): CheckInRequestDto => ({
  user: fakeUser(),
  userConsent: fakeConsent(),
  externalIds: fakeExternalIds(),
  ...overrides,
});
```

#### Factory conventions

**One factory file per domain entity** — colocate them under `src/testing/factories/` and name them `<entity>.factory.ts`.

**Always use `Partial<T>` overrides, never positional arguments** — this keeps call sites readable and avoids breaking changes when the type gains new required fields.

**Compose factories, don't inline sub-objects** — build nested DTOs by calling other factories so each factory stays single-responsibility:

```typescript
// Bad — inline construction leaks internal structure into the test
const dto = fakeCheckInRequest({
  user: { email: "x@y.com", firstName: "A", lastName: "B", ... },
});

// Good — delegate to the sub-factory and override only what matters
const dto = fakeCheckInRequest({
  user: fakeUser({ email: "x@y.com" }),
});
```

**Pin fields only when the test depends on them** — if the test doesn't care about the value, let faker randomise it. This surfaces fragile assumptions and makes intent explicit:

```typescript
it("rejects a request when SSN is not exactly 4 digits", async () => {
  // Only the ssn matters here — everything else is noise
  const dto = fakeCheckInRequest({ user: fakeUser({ ssn: "12" }) });
  const result = await processCheckIn(dto);
  expect(result.success).toBe(false);
});
```

**Use a fixed faker seed in CI** to make failures reproducible without sacrificing randomness during local development:

```typescript
// jest.setup.ts
import { faker } from "@faker-js/faker";

beforeEach(() => {
  // Seed changes each test run locally; pin it in CI via env var
  faker.seed(process.env["CI"] ? 12345 : Math.random() * 100_000);
});
```

### Mocking conventions

- Use `jest.fn()` for function mocks; type them explicitly.
- Use `jest.mock()` at the module level, not inside individual tests.
- Reset all mocks in `beforeEach`, not `afterEach`.

```typescript
const mockUserRepository: jest.Mocked<UserRepository> = {
  findById: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
});
```

### Assertion style

Prefer specific matchers over generic ones:

```typescript
// Less precise
expect(result).toBeTruthy();
expect(arr.length).toBe(3);

// More precise
expect(result).toBeDefined();
expect(arr).toHaveLength(3);
expect(arr).toContainEqual(expect.objectContaining({ id: "123" }));
```

---

## Linting and Formatting

### ESLint (with TypeScript support)

```json
// eslint.config.js — flat config style
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "no-console": "warn"
  }
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

---

## Git and Commit Hygiene

- One logical change per commit.
- Commit message format: `<type>(<scope>): <short description>`
  - `feat(auth): add JWT refresh token rotation`
  - `fix(user): handle null email in normalisation`
  - `test(orders): cover partial fulfilment edge case`
  - `refactor(db): extract query builder to separate module`
- Never commit code with `TODO` comments unless the task is tracked in the issue tracker with a reference.

---

## Things Claude Should Never Do

- Add `// @ts-ignore` or `// @ts-nocheck` comments.
- Use `any` as a type.
- Leave a `catch` block empty or with only a `console.log`.
- Skip the `noUncheckedIndexedAccess` contract by assuming array access is safe.
- Write tests that only test the happy path.
- Assert types with `as` in business logic — write a type guard instead.
- Create barrel files that re-export everything from a folder indiscriminately.
- Use `new Date()` directly in business logic — accept it as a parameter or inject a clock for testability.
