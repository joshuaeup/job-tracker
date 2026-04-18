# TypeScript Standards

Standards for building a well-structured, maintainable TypeScript project. Derived from a production NestJS codebase running Node 24, TypeScript 5.9, and ESLint 9.

---

## Compiler Configuration

### `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2017",
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "incremental": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

**Key decisions:**

- `emitDecoratorMetadata` and `experimentalDecorators` are required for NestJS decorator-based DI.
- `declaration: true` in library `tsconfig.lib.json` files so consumers get type definitions.
- `skipLibCheck: true` for build performance — type-check your own code, not `node_modules`.
- `resolveJsonModule: true` for importing JSON config files.

### Build Exclusions (`tsconfig.build.json`)

```jsonc
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

Test files and output are never compiled into the production build.

### Path Aliases

Define path aliases to avoid deep relative imports. Mirror these in Jest config.

```jsonc
{
  "paths": {
    "@app/config": ["src/app.config"],
    "@handler/data-reconciliation": ["libs/data-reconciliation/src"],
    "@shared/redis-client": ["libs/redis-client/src"],
    "@shared/redis-feature": ["libs/redis-feature/src"],
    "@mocks/*": ["test/mocks/*"]
  }
}
```

**Convention:** Use semantic prefixes — `@app/` for app-level, `@shared/` for cross-cutting libraries, `@handler/` for domain handlers, `@mocks/` for test utilities.

---

## Linting and Formatting

### ESLint 9 (Flat Config)

Use `eslint.config.mjs` with the flat config format:

```js
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/*.mjs', 'dist/**/*', 'coverage/**/*'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
      'unused-imports': eslintPluginUnusedImports,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
);
```

**Non-negotiable rules:**

| Rule | Setting | Why |
|------|---------|-----|
| `simple-import-sort/imports` | `error` | Deterministic, auto-fixable import ordering |
| `simple-import-sort/exports` | `error` | Consistent export ordering |
| `unused-imports/no-unused-imports` | `error` | Dead imports clutter and confuse |
| `unused-imports/no-unused-vars` | `error` | Catch dead code; `^_` prefix opts out |

**Underscore convention:** Prefix intentionally unused variables with `_` (e.g., `_unusedParam`).

### Prettier

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "parser": "typescript"
}
```

Prettier is integrated into ESLint via `eslint-plugin-prettier/recommended`, so a single `npm run lint -- --fix` handles both formatting and linting.

---

## Type System Conventions

### When to Use `interface` vs `type` vs `class`

| Use Case | Construct | Example |
|----------|-----------|---------|
| Config shapes | `interface` | `interface AppConfig { port: number; redis: RedisConfig; }` |
| Service contracts | `interface` | `interface ILenderService<TReq, TRes, TData>` |
| Trivial aliases | `type` | `type Header = Record<string, string>` |
| DTOs with validation | `class` | `class AggregatorRequest { @IsString() name!: string; }` |
| Enum-like constants | `enum` (string) | `enum IntegrationId { Bulldog = 'uuid-here' }` |

### Generic Type Patterns

Use generics to create flexible contracts that are narrowed at the call site:

```typescript
export interface ILenderService<
  TRequest = any,
  TResponse = any,
  TProductData = any,
> {
  readonly IntegrationId: string;
  readonly IntegrationCode: string;
  readonly IntegrationName: string;

  formatRequest(request: AggregatorRequest, headers?: IncomingHttpHeaders): Promise<TRequest>;
  requestOffers(request: TRequest): Promise<TResponse>;
  formatResponse(response: TResponse): Promise<QuestResponse<TProductData>>;
}
```

### DTO Validation with `class-validator`

DTOs are classes (not interfaces) because `class-validator` needs runtime metadata:

```typescript
export class Applicant {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsOptional()
  ssn?: string;

  @IsNumber()
  @IsOptional()
  annualIncome?: number;
}

export class AggregatorRequest {
  @IsObject()
  @ValidateNested()
  @IsNotEmptyObject()
  @Type(() => Applicant)
  applicant!: Applicant;

  @IsArray()
  @IsNotEmpty()
  @IsEnum(IntegrationId, { each: true })
  integrationIds!: IntegrationId[];
}
```

**Patterns:**
- Use `!` (definite assignment) on required fields.
- Use `?` on optional fields paired with `@IsOptional()`.
- Use `@Type(() => NestedClass)` from `class-transformer` for nested objects.
- Use `@IsEnum(EnumType, { each: true })` for enum arrays.
- Apply `@ValidateNested()` on nested objects so child validators fire.

### Enums

Use **string enums** for values that appear in APIs or logs — they're readable in payloads and debuggable:

```typescript
export enum IntegrationId {
  Bulldog = '550e8400-e29b-41d4-a716-446655440000',
  Upgrade = '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
}
```

---

## Code Organization

### Import Order

`simple-import-sort` auto-sorts imports into groups:

1. External packages (`@nestjs/common`, `class-validator`)
2. Internal path aliases (`@shared/redis-client`, `@handler/data-reconciliation`)
3. Relative imports (`./dto/request.dto`, `../exceptions`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';

import { BulldogService } from '../integrations/bulldog/bulldog.service';
import { ILenderService } from '../integrations/integration.interface';
import { IntegrationId } from '../integrations/integration.model';
import { AggregatorRequest } from './dto/aggregator-request.dto';
```

### Barrel Exports (`index.ts`)

Every module and library exposes a public API through `index.ts`:

```typescript
// Minimal facade — only what consumers need
export * from './data-reconciliation.module';
export * from './data-reconciliation.service';
```

For shared libraries with broader APIs:

```typescript
export { RedisClientMock } from './mock/redis-client.mock';
export * from './redis.client';
export * from './redis-client.constants';
export * from './redis-client.module';
export * from './redis-client.service';
```

**Rule:** Export the minimum surface area. Internal implementation details stay internal.

### Custom Exceptions

Extend framework exception classes. Keep them small and domain-specific:

```typescript
import { InternalServerErrorException } from '@nestjs/common';

/**
 * Thrown when we are unable to format the request for the integration
 */
export class RequestMappingException extends InternalServerErrorException {
  constructor(error: Error) {
    super(error.message);
    this.name = RequestMappingException.name;
  }
}
```

Group related exceptions with a barrel:

```typescript
// exceptions/index.ts
export * from './integration-not-found.exception';
export * from './integration-request.exception';
export * from './request-mapping.exception';
export * from './response-mapping.exception';
```

### Utility Functions

Pure helper functions go in `utils/` with JSDoc:

```typescript
/**
 * Parses an integer from a string that may contain special characters
 * typically found in a price listing. Ex: $12,000.26
 */
export function convertCurrencyToNumber(value: string): number {
  try {
    return parseInt(value.replace('$', '').replace(',', ''));
  } catch (error) {
    return 0;
  }
}

/**
 * Calculates the monthly payment of a loan
 * @param loanAmount the total value of the loan
 * @param interestRate the yearly interest rate or APR. Ex: 9.49 for 9.49%
 * @param loanTermInMonths term of the loan in months
 */
export function calculateMonthlyPayment(
  loanAmount: number,
  interestRate: number,
  loanTermInMonths: number,
): number {
  const monthlyInterestRate = interestRate / 100 / 12;
  const numberOfPayments = loanTermInMonths;
  const monthlyPayment =
    (loanAmount * monthlyInterestRate) /
    (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments));
  return Number(monthlyPayment.toFixed(2));
}
```

---

## Engine and Version Pinning

### `package.json`

```json
{
  "engines": {
    "node": "~24",
    "npm": ">=10"
  }
}
```

### `.nvmrc`

```
24
```

Pin the Node version so every developer, CI runner, and Docker image uses the same runtime.

---

## Summary Checklist

- [ ] `tsconfig.json` with path aliases, decorator support, `skipLibCheck`
- [ ] `tsconfig.build.json` excluding tests and output
- [ ] ESLint 9 flat config with type-checked rules, Prettier, import sorting, unused import removal
- [ ] Prettier with `singleQuote`, `trailingComma: "all"`
- [ ] `interface` for contracts and config, `class` for DTOs, `type` for aliases, string `enum` for constants
- [ ] Barrel exports in every module and library
- [ ] Path aliases mirrored in Jest `moduleNameMapper`
- [ ] Node version pinned in `.nvmrc` and `package.json` engines
