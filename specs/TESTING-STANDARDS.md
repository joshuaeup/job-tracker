# Testing Standards

Comprehensive testing patterns for TypeScript projects. Covers unit tests, E2E tests, snapshot testing, mocking strategies, test data factories, and coverage configuration.

---

## Test Structure Overview

```
project-root/
├── src/
│   ├── feature/
│   │   ├── feature.service.ts
│   │   ├── feature.service.spec.ts      # Unit test co-located with source
│   │   ├── feature.controller.ts
│   │   └── feature.controller.spec.ts
├── libs/
│   └── my-lib/
│       └── src/
│           ├── my-lib.service.ts
│           └── my-lib.service.spec.ts   # Lib unit tests co-located too
├── test/
│   ├── __snapshots__/                   # Jest snapshot files
│   ├── test-cases/                      # Shared test case definitions
│   │   ├── base.ts                      # Common interfaces and types
│   │   ├── feature-a.ts                 # Feature-specific test cases
│   │   ├── feature-b.ts                 # Feature-specific test cases
│   │   └── index.ts                     # Barrel aggregating all cases
│   ├── mocks/                           # Shared mock implementations
│   │   ├── cache-manager.mock.ts
│   │   └── config-service.mock.ts
│   ├── factories/                       # Test data factories
│   │   └── entity.factory.ts
│   ├── jest-env-setup.ts                # Global test environment setup
│   ├── jest-e2e.json                    # E2E-specific Jest config
│   ├── README.md                        # Testing guide
│   └── *.e2e-spec.ts                   # End-to-end test files
```

**Rules:**
- Unit tests (`.spec.ts`) are **co-located** with source files.
- E2E tests (`.e2e-spec.ts`) live in the top-level `test/` directory.
- Shared test infrastructure (mocks, factories, test cases) lives in `test/`.

---

## Jest Configuration

### Unit Tests (in `package.json`)

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "./",
    "roots": ["<rootDir>/src/", "<rootDir>/libs/"],
    "testRegex": ".spec.ts$",
    "transform": {
      "^.+\\.ts$": "ts-jest"
    },
    "setupFiles": ["<rootDir>/test/jest-env-setup.ts"],
    "collectCoverageFrom": [
      "**/*.ts",
      "!**/node_modules/**",
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
    ],
    "moduleNameMapper": {
      "^@app/config$": "<rootDir>/src/app.config",
      "^@shared/redis-client$": "<rootDir>/libs/redis-client/src",
      "^@mocks/(.*)$": "<rootDir>/test/mocks/$1"
    },
    "coverageDirectory": "./coverage",
    "testEnvironment": "node"
  }
}
```

**Key patterns:**
- `roots` includes both `src/` and `libs/` so all unit tests are discovered.
- `moduleNameMapper` mirrors `tsconfig.json` path aliases exactly.
- `collectCoverageFrom` **excludes** boilerplate files (controllers, modules, DTOs, factories, barrel exports, `main.ts`) so coverage reflects testable logic only.
- `setupFiles` runs environment preparation before any test.

### E2E Tests (`test/jest-e2e.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "setupFiles": ["<rootDir>/test/jest-env-setup.ts"],
  "moduleNameMapper": {
    "^@app/config$": "<rootDir>/src/app.config",
    "^@shared/redis-client$": "<rootDir>/libs/redis-client/src",
    "^@mocks/(.*)$": "<rootDir>/test/mocks/$1"
  }
}
```

### Environment Setup (`test/jest-env-setup.ts`)

```typescript
process.env.NEW_RELIC_ENABLED = 'false';

// Workaround for Jest/performance compatibility
if (typeof global.performance === 'undefined') {
  (global as any).performance = { now: Date.now };
}
```

Disable external services (APM, telemetry) in tests. Patch globals that Jest doesn't provide.

---

## npm Scripts

```json
{
  "test": "jest --no-watchman",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage --no-watchman --ci --runInBand",
  "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e": "jest --config test/jest-e2e.json --no-watchman",
  "test:e2e:snapshot": "jest --config test/jest-e2e.json --no-watchman -u"
}
```

---

## Unit Test Patterns

### Structure: Arrange-Act-Assert

```typescript
describe('AggregatorService', () => {
  let service: AggregatorService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      // ... providers and overrides
    }).compile();

    service = moduleRef.get<AggregatorService>(AggregatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('aggregateOffers', () => {
    it('should return products from all integrations', async () => {
      // Arrange
      const inputRequest = AggregatorFactory.createQuestRequest({
        integrationIds: [IntegrationId.Bulldog],
      });
      const expectedProducts = [/* ... */];

      jest.spyOn(service, 'fetchOffers').mockResolvedValue(expectedProducts);

      // Act
      const actual = await service.aggregateOffers(inputRequest, {});

      // Assert
      expect(actual.products).toEqual(expectedProducts);
    });
  });
});
```

### Variable Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `input` | Data being passed to the method under test | `inputRequest`, `inputHeaders` |
| `mock` | Stubbed dependencies or return values | `mockResponse`, `mockService` |
| `actual` | The result of calling the method under test | `actualResult`, `actualProducts` |
| `expected` | The value you assert against | `expectedProducts`, `expectedError` |

### NestJS TestingModule Setup

**Pattern 1: Import real module, override externals**

```typescript
beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [FeatureModule],
  })
    .overrideProvider(CACHE_MANAGER)
    .useValue(cacheManagerMock)
    .overrideProvider(ExternalService)
    .useClass(ExternalServiceMock)
    .compile();

  controller = moduleRef.get<FeatureController>(FeatureController);
});
```

**Pattern 2: Build custom module for integration tests**

```typescript
beforeEach(async () => {
  const module = await Test.createTestingModule({
    imports: [
      HttpModule,
      ValidationModule,
      ObjectConfigModule.forRoot({
        configFactory: () => mockedConfig,
        requiredEnvironmentVariables,
      }),
    ],
    providers: [ServiceUnderTest, DependencyA, DependencyB],
  })
    .setLogger(new TestLogger())
    .overrideProvider(Auth0Provider)
    .useClass(Auth0ProviderMock)
    .compile();

  service = module.get<ServiceUnderTest>(ServiceUnderTest);
});
```

**Pattern 3: Request-scoped services**

```typescript
const contextId = ContextIdFactory.create();

beforeEach(async () => {
  const module = await Test.createTestingModule({ /* ... */ }).compile();
  service = await module.resolve(RequestScopedService, contextId);
});
```

---

## Mocking Strategies

### 1. `jest.spyOn` on Real Services

Preferred for unit tests — lets you verify calls without replacing the whole service:

```typescript
const spy = jest.spyOn(baseplateService, 'getBaseplate')
  .mockResolvedValue(mockBaseplate);

// ... call the method under test ...

expect(spy).toHaveBeenCalledWith(expectedArg);
```

### 2. Partial Object Mocks

For simple dependencies like cache managers:

```typescript
// test/mocks/cache-manager.mock.ts
export const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};
```

### 3. Class Mocks Extending Abstracts

For typed mock classes that satisfy DI:

```typescript
export class ObjectConfigServiceMock
  extends ObjectConfigServiceMockAbstract<AppConfig> {
  // Override specific methods as needed
}
```

### 4. Module-Level `jest.mock`

For packages that resist `spyOn` (e.g., default exports):

```typescript
jest.mock('jsonwebtoken');

import * as jwt from 'jsonwebtoken';

jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);
```

### Cleanup

```typescript
afterEach(() => {
  jest.restoreAllMocks();
});
```

---

## Test Data Factories

Use static factory classes with `@faker-js/faker` and `Partial<T>` overrides:

```typescript
import { faker } from '@faker-js/faker';

export class EntityFactory {
  static createApplicant(override: Partial<Applicant> = {}): Applicant {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      annualIncome: faker.number.int({ min: 30000, max: 200000 }),
      creditScore: faker.number.int({ min: 300, max: 850 }),
      ...override,
    };
  }

  static createRequest(
    override: Partial<RequestDTO> = {},
  ): RequestDTO {
    return {
      applicant: this.createApplicant(),
      integrationIds: [],
      contextMetadata: this.createContextMetadata(),
      ...override,
    };
  }

  static createResponse<T>(
    override: Partial<Response<T>> = {},
  ): Response<T> {
    return {
      products: [{
        integration: { code: faker.word.sample().toUpperCase(), uuid: faker.string.uuid() },
        sku: faker.string.uuid(),
        url: faker.internet.url(),
        productData: {} as T,
      }],
      ...override,
    };
  }
}
```

**Rules:**
- Every factory method accepts `Partial<T>` overrides via spread.
- Defaults produce valid, realistic data via Faker.
- Generic factory methods (like `createResponse<T>`) preserve type flexibility.
- Factories are static classes — no instantiation needed.

---

## Test Case Definitions

For parameterized/data-driven tests, define structured test cases:

```typescript
// test/test-cases/base.ts
export interface ProcessorTestCase {
  name: string;
  issuerProduct: () => IssuerProduct;
  papiProduct: PapiProduct;
}
```

```typescript
// test/test-cases/feature-a.ts
export const featureATestCase: ProcessorTestCase = {
  name: 'FeatureA',
  issuerProduct: () => FeatureAFactory.createProduct(),
  papiProduct: { /* expected output */ },
};
```

```typescript
// test/test-cases/index.ts
export const TEST_CASES: ProcessorTestCase[] = [
  featureATestCase,
  featureBTestCase,
];

export const DERIVED_DATA = TEST_CASES.map((tc) => tc.papiProduct);
```

Use the barrel to drive parameterized E2E tests:

```typescript
import { TEST_CASES } from './test-cases';

describe.each(TEST_CASES)('$name processor', ({ name, issuerProduct, papiProduct }) => {
  it(`should process ${name} correctly`, async () => {
    // ...
  });
});
```

---

## Snapshot Testing

### When to Use Snapshots

- Complex response structures where hand-writing assertions is brittle.
- Data transformation pipelines where output shape matters.
- **Not** for simple values or UI components in a backend context.

### Pattern

```typescript
it.each(TEST_CASES)('should match $name processor flow', async ({ name }) => {
  const result = await service.process(inputData);
  expect(result).toMatchSnapshot(`${name.toLowerCase()} processor flow`);
});
```

### Snapshot Maintenance

- **Review snapshot diffs** in PRs — treat them as code changes.
- **Update snapshots** only for intentional changes: `npm run test:e2e -- -u`.
- **Named snapshots** (`toMatchSnapshot('descriptive name')`) make diffs readable.
- Snapshot files live in `test/__snapshots__/` and are committed to version control.

---

## E2E Test Patterns

### Structure: Given-When-Then

```typescript
describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .setLogger(new TestLogger())
      .overrideProvider(CACHE_MANAGER)
      .useValue(cacheManagerMock)
      .overrideProvider(ObjectConfigService)
      .useClass(ObjectConfigServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET) should return ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', info: {}, error: {}, details: {} });
  });
});
```

### E2E Best Practices

- **Import the real `AppModule`** and override only external dependencies.
- **Use `TestLogger`** to suppress noise but capture errors.
- **Close the app** in `afterEach` to avoid port conflicts.
- **Use `supertest`** for HTTP assertions.
- **Test actual HTTP semantics** — status codes, headers, response shapes.

---

## Coverage Configuration

### What to Measure

Coverage should reflect **testable business logic**, not boilerplate:

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

**Rationale:** Controllers are thin wrappers, DTOs are declarative, modules are wiring, factories are test infrastructure. None of these benefit from line-coverage metrics.

### Running Coverage

```bash
npm run test:cov
```

Generates a `coverage/` directory with HTML reports. CI should track coverage trends over time.

---

## lint-staged Integration

Tests run on commit as part of the pre-commit hook:

```json
{
  "lint-staged": {
    "*.{js,ts}": [
      "npm run format",
      "npm run lint",
      "npm run test -- --bail --findRelatedTests --passWithNoTests",
      "npm run test:e2e -- --bail --findRelatedTests --passWithNoTests"
    ]
  }
}
```

**Key flags:**
- `--bail` — stop on first failure for fast feedback.
- `--findRelatedTests` — only run tests affected by staged files.
- `--passWithNoTests` — don't fail when staged files have no related tests.

---

## Summary Checklist

- [ ] Unit tests co-located with source (`*.spec.ts`)
- [ ] E2E tests in `test/` directory (`*.e2e-spec.ts`)
- [ ] Shared mocks in `test/mocks/`
- [ ] Factories using `@faker-js/faker` with `Partial<T>` overrides
- [ ] Test cases in `test/test-cases/` with barrel export
- [ ] AAA pattern for unit tests, Given-When-Then for E2E
- [ ] Named snapshots for complex data transformations
- [ ] Coverage excludes boilerplate, targets business logic
- [ ] Jest `moduleNameMapper` mirrors TypeScript path aliases
- [ ] `jest-env-setup.ts` disables external services
- [ ] `lint-staged` runs related tests on commit
