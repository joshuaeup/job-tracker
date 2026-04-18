# Standards for Claude — TypeScript Codebase Refactoring Guide

You are refactoring an existing TypeScript codebase to meet production-grade standards. This file is your primary reference. The companion spec files in this directory contain full details — reference them when you need specifics.

## Companion Specs

| File | Covers |
|------|--------|
| `TYPESCRIPT-STANDARDS.md` | Compiler config, linting, formatting, type system, import ordering |
| `TESTING-STANDARDS.md` | Jest setup, unit/E2E patterns, mocking, factories, snapshots, coverage |
| `PROJECT-ARCHITECTURE.md` | Module structure, DI, decoupled integrations, strategy/factory pattern |
| `DOCUMENTATION-STANDARDS.md` | README hierarchy, JSDoc, Swagger, PR templates, changelogs |
| `DEVOPS-AND-WORKFLOWS.md` | CI/CD, Docker, git hooks, commits, semantic release, Dependabot |

---

## How to Use This Guide

1. **Read this file first** to understand priorities and sequencing.
2. **Read specific spec files** when working on that area.
3. **Work incrementally** — don't try to refactor everything at once.
4. **Preserve existing behavior** — refactoring is structural, not functional.

---

## Refactoring Priority Order

Work through these in order. Each phase should leave the codebase in a working state.

### Phase 1: Foundation (Do First)

These are non-breaking changes that establish the quality baseline.

#### 1.1 Tooling Configuration

- [ ] Set up `tsconfig.json` with path aliases, decorator support, `skipLibCheck`
- [ ] Create `tsconfig.build.json` excluding tests and dist
- [ ] Install and configure ESLint 9 flat config with:
  - `typescript-eslint/recommendedTypeChecked`
  - `eslint-plugin-prettier/recommended`
  - `eslint-plugin-simple-import-sort` (imports + exports as `error`)
  - `eslint-plugin-unused-imports` (unused imports as `error`, `^_` pattern for intentional unused vars)
- [ ] Configure Prettier: `singleQuote: true`, `trailingComma: "all"`
- [ ] Pin Node version in `.nvmrc` and `package.json` engines
- [ ] Set up `.vscode/settings.json` with format-on-save and workspace TypeScript

**Validation:** `npm run lint` and `npm run format:check` pass with zero errors.

#### 1.2 Git Hooks and Commit Standards

- [ ] Install husky, commitlint, lint-staged
- [ ] Configure `commitlint.config.mjs` extending `@commitlint/config-conventional`
- [ ] Configure `.husky/pre-commit` to run `npx lint-staged`
- [ ] Configure `.husky/commit-msg` to run `npx commitlint --edit $1`
- [ ] Set up lint-staged in `package.json` to run format, lint, and related tests

**Validation:** A commit with message `bad message` is rejected. A commit with `feat: add thing` is accepted.

### Phase 2: Code Structure

#### 2.1 Import Cleanup

Run `eslint --fix` to auto-sort all imports and remove unused imports. This is the single highest-impact low-effort change.

#### 2.2 Barrel Exports

Add `index.ts` barrel files to every module directory. Export only the public API:

```typescript
// Minimal — most modules
export * from './feature.module';
export * from './feature.service';

// Broader — shared libraries
export { FeatureMock } from './mock/feature.mock';
export * from './feature.module';
export * from './feature.service';
export * from './feature.constants';
```

**Rule:** If another module imports from a deep path like `../feature/internal/helper`, that's a barrel export missing. The consumer should import from `../feature` (the barrel).

#### 2.3 Path Aliases

Replace deep relative imports (`../../../../shared/utils`) with path aliases:

```typescript
// Before
import { helper } from '../../../../shared/utils/helper';

// After
import { helper } from '@shared/utils';
```

Define in `tsconfig.json`:
```json
{
  "paths": {
    "@app/*": ["src/*"],
    "@shared/*": ["libs/shared/src/*"],
    "@mocks/*": ["test/mocks/*"]
  }
}
```

Mirror in Jest `moduleNameMapper`.

#### 2.4 Module Boundaries

Each feature should be a self-contained module:

```
src/feature/
├── feature.module.ts          # Imports, providers, exports
├── feature.controller.ts      # HTTP layer: guards, validation, delegation
├── feature.service.ts         # Business logic
├── feature.service.spec.ts    # Unit test
├── dto/
│   ├── feature-request.dto.ts
│   └── feature-response.dto.ts
└── exceptions/
    ├── index.ts
    └── feature-specific.exception.ts
```

### Phase 3: Type Safety

#### 3.1 DTO Validation

Convert request/response interfaces to classes with `class-validator` decorators:

```typescript
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => NestedDto)
  nested!: NestedDto;
}
```

Apply `ValidationPipe` on controllers:

```typescript
@UsePipes(new ValidationPipe())
@Post()
async create(@Body() request: CreateRequest) {}
```

#### 3.2 Service Contracts

Define interfaces for services that have multiple implementations or need mocking:

```typescript
export interface IExternalService<TRequest = any, TResponse = any> {
  readonly ServiceName: string;
  formatRequest(input: AppRequest): Promise<TRequest>;
  call(request: TRequest): Promise<TResponse>;
  formatResponse(response: TResponse): Promise<AppResponse>;
}
```

#### 3.3 Custom Exceptions

Replace generic `throw new Error()` with domain-specific exceptions:

```typescript
// Before
throw new Error('Integration not found');

// After
export class IntegrationNotFoundException extends InternalServerErrorException {
  constructor(integrationId: string) {
    super(integrationId);
    this.name = IntegrationNotFoundException.name;
  }
}
```

Group with barrel exports in `exceptions/index.ts`.

#### 3.4 Enums Over Magic Strings

Replace string literals used for routing/identification with string enums:

```typescript
// Before
if (type === '550e8400-e29b-41d4-a716-446655440000') {}

// After
export enum IntegrationId {
  Bulldog = '550e8400-e29b-41d4-a716-446655440000',
}
if (type === IntegrationId.Bulldog) {}
```

### Phase 4: Testing

#### 4.1 Test Infrastructure

Set up the test directory structure:

```
test/
├── mocks/           # Shared mock implementations
├── factories/       # Test data factories with @faker-js/faker
├── test-cases/      # Structured test case definitions
├── jest-e2e.json    # E2E config
├── jest-env-setup.ts # Environment prep (disable APM, patch globals)
└── README.md        # Testing guide
```

#### 4.2 Test Data Factories

Create factories for every domain entity:

```typescript
import { faker } from '@faker-js/faker';

export class EntityFactory {
  static create(override: Partial<Entity> = {}): Entity {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      ...override,  // Caller overrides only what matters for their test
    };
  }
}
```

**Critical pattern:** `Partial<T>` override spread. This lets test authors specify only the fields relevant to their test case while getting valid defaults for everything else.

#### 4.3 Unit Tests

Co-locate with source. Follow AAA (Arrange-Act-Assert):

```typescript
describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ServiceName, /* deps */],
    })
      .overrideProvider(ExternalDep)
      .useValue(mockExternalDep)
      .compile();

    service = module.get(ServiceName);
  });

  describe('methodName', () => {
    it('should do the expected thing', async () => {
      // Arrange
      const inputData = EntityFactory.create({ name: 'specific' });
      jest.spyOn(dependency, 'method').mockResolvedValue(mockResult);

      // Act
      const actual = await service.methodName(inputData);

      // Assert
      expect(actual).toEqual(expectedResult);
      expect(dependency.method).toHaveBeenCalledWith(expectedArg);
    });
  });
});
```

**Variable naming:** `inputX`, `mockX`, `actualX`, `expectedX`.

#### 4.4 E2E Tests

In `test/` directory. Boot the real app module with overridden externals:

```typescript
describe('Feature (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .setLogger(new TestLogger())
      .overrideProvider(ExternalService)
      .useClass(ExternalServiceMock)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /endpoint returns expected response', () => {
    return request(app.getHttpServer())
      .post('/endpoint')
      .send(validPayload)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchSnapshot('endpoint success');
      });
  });
});
```

#### 4.5 Coverage Configuration

Exclude boilerplate from coverage metrics:

```json
{
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.controller.*",
    "!**/*.dto.*",
    "!**/*.mock.*",
    "!**/*.module.*",
    "!**/*.factory.*",
    "!**/config/**",
    "!**/types.ts",
    "!**/types/**",
    "!**/index.ts",
    "!**/main.ts"
  ]
}
```

### Phase 5: Documentation

#### 5.1 JSDoc on Public APIs

Add docstrings to:
- Interface methods (full TSDoc with `@template`, `@param`, `@returns`)
- Custom exceptions (one-line: when is this thrown?)
- Public service methods (one-line: what does this do?)
- Utility functions (purpose + param descriptions for non-obvious ones)

**Do not** add comments that restate what code already says.

#### 5.2 Swagger Decorators

On every controller endpoint:
- `@ApiTags('GroupName')`
- `@ApiOperation({ summary: '...' })`
- `@ApiBody({ type: RequestDto })`
- `@ApiOkResponse({ type: ResponseDto })`
- `@ApiHeader` for auth headers

Enable the Swagger plugin in `nest-cli.json`:
```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@nestjs/swagger",
      "options": { "introspectComments": true }
    }]
  }
}
```

#### 5.3 README Files

- **Root:** Setup, run, test, deploy instructions
- **Per-library:** Architecture, dev guide for extending, testing strategy
- **Per-component:** Specific behavior, data flow, attribute overrides
- **Test directory:** `test/README.md` with testing guide

#### 5.4 PR Template

Create `.github/pull_request_template.md`:
```markdown
<!-- Ticket number -->
TICKET-

## Description

## Testing

## Checklist
- [ ] Tests
- [ ] Documentation
```

### Phase 6: DevOps

#### 6.1 Semantic Release

```bash
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github
```

Configure `release.config.mjs` with commit-analyzer, release-notes, changelog, git, github plugins.

#### 6.2 CI/CD

- Checks workflow on PR branches (lint, test, build)
- Dev deployment on merge to main
- Production deployment via manual trigger

#### 6.3 Dependabot

Monthly npm updates, grouped by ecosystem (e.g., all NestJS together), patch versions ignored.

#### 6.4 Docker

Multi-stage Dockerfile:
1. Builder stage with dev deps for compilation
2. Runtime stage with production deps only
3. Alpine base for minimal image size
4. `apk upgrade` for security patching

---

## Common Refactoring Patterns

### Replacing God Services

If a service does too many things, split by responsibility:

```
# Before
big.service.ts (500+ lines, 15 methods)

# After
feature-a.service.ts (handles domain A)
feature-b.service.ts (handles domain B)
orchestrator.service.ts (coordinates A and B)
```

### Decoupling Integrations

If external service calls are scattered:

1. Define a contract interface with `formatRequest`, `call`, `formatResponse`
2. Implement one class per integration
3. Route via Map or Factory
4. Each integration gets its own directory and module

### Replacing Hardcoded Config

```typescript
// Before
const url = 'https://api.vendor.com/v1';
const timeout = 5000;

// After (in config factory)
export const configFactory = () => ({
  vendor: {
    url: env('VENDOR_URL', 'https://api.vendor.com/v1'),
    timeout: env('VENDOR_TIMEOUT', 5000),
  },
});
```

### Cleaning Up Error Handling

```typescript
// Before
try {
  await doEverything();
} catch (e) {
  console.log(e);
  throw e;
}

// After — granular try/catch with domain exceptions
try {
  const formatted = await service.formatRequest(request);
  const response = await service.callExternal(formatted);
  return await service.formatResponse(response);
} catch (error) {
  if (error instanceof RequestMappingException) {
    logger.error('Failed to format request', { error });
    return fallbackResponse;
  }
  throw error;
}
```

### Graceful Degradation

When aggregating from multiple sources, one failure shouldn't fail all:

```typescript
async aggregate(ids: string[]): Promise<Result[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await this.fetch(id);
      } catch (error) {
        this.logger.error(error);
        return [];  // Return empty, don't throw
      }
    }),
  );
  return results.flat();
}
```

---

## Anti-Patterns to Fix

| Anti-Pattern | Fix |
|-------------|-----|
| `any` everywhere | Add proper types, generics, interfaces |
| `console.log` for logging | Use framework Logger (`new Logger(ClassName.name)`) |
| Magic strings | String enums |
| Deep relative imports | Path aliases (`@app/`, `@shared/`) |
| No barrel exports | Add `index.ts` to every module |
| Tests reaching into internals | Test through public API, mock at module boundary |
| Shared mutable state in tests | `beforeEach` setup, factory functions |
| `throw new Error('message')` | Domain-specific exception classes |
| Config via scattered `process.env` | Typed config factory with validation |
| No commit standards | Conventional Commits + commitlint |
| Manual formatting | Prettier + ESLint + format-on-save |
| No pre-commit checks | Husky + lint-staged |

---

## Verification Checklist

After refactoring, verify:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
- [ ] `npm run test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] `npm run test:cov` — coverage report generates
- [ ] A conventional commit is accepted by commitlint
- [ ] A non-conventional commit is rejected
- [ ] `npm run start:dev` — the app starts and responds to health checks
- [ ] Swagger UI loads at `/api` in local environment
- [ ] Docker build completes successfully
