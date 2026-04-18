# Project Architecture Standards

Patterns for structuring a modular, extensible TypeScript backend. Covers project layout, module boundaries, dependency injection, decoupled integrations, and the strategy/factory pattern.

---

## Directory Structure

```
project-root/
├── src/                          # Application source
│   ├── main.ts                   # Bootstrap and server config
│   ├── app.module.ts             # Root module composing all features
│   ├── app.config.ts             # Typed config factory with env vars
│   ├── aggregator/               # Feature module
│   │   ├── aggregator.controller.ts
│   │   ├── aggregator.controller.spec.ts
│   │   ├── aggregator.service.ts
│   │   ├── aggregator.service.spec.ts
│   │   ├── dto/
│   │   │   ├── aggregator-request.dto.ts
│   │   │   └── aggregator-response.dto.ts
│   │   └── exceptions/
│   │       ├── index.ts
│   │       ├── request-mapping.exception.ts
│   │       └── integration-not-found.exception.ts
│   ├── integrations/             # External service adapters
│   │   ├── integration.interface.ts   # Contract all adapters implement
│   │   ├── integration.model.ts       # Enums, constants
│   │   ├── bulldog/
│   │   │   ├── bulldog.service.ts
│   │   │   └── dto/
│   │   ├── upgrade/
│   │   └── monevo/
│   ├── auth/                     # Auth module (JWT, OAuth, cache)
│   ├── health/                   # Health checks
│   ├── api-docs/                 # Swagger configuration
│   └── utils/                    # Pure utility functions
├── libs/                         # Internal libraries (Nest monorepo-style)
│   ├── data-reconciliation/
│   │   ├── src/
│   │   │   ├── index.ts                          # Barrel: module + service only
│   │   │   ├── data-reconciliation.module.ts
│   │   │   ├── data-reconciliation.service.ts
│   │   │   ├── data-reconciliation.controller.ts
│   │   │   ├── interfaces/
│   │   │   ├── dto/
│   │   │   ├── processors/                       # Per-integration strategy modules
│   │   │   │   ├── bulldog/
│   │   │   │   │   ├── bulldog-integration.module.ts
│   │   │   │   │   ├── bulldog-integration.service.ts
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── constants.ts
│   │   │   │   │   ├── utils/
│   │   │   │   │   ├── factories/
│   │   │   │   │   └── README.md
│   │   │   │   ├── knockout/
│   │   │   │   ├── monevo/
│   │   │   │   ├── upgrade/
│   │   │   │   └── global/                       # Cross-cutting post-processing
│   │   │   ├── validation/
│   │   │   └── util/
│   │   ├── tsconfig.lib.json
│   │   └── README.md
│   ├── redis-client/             # Shared infrastructure library
│   └── redis-feature/            # Feature-scoped library on top of redis-client
├── test/                         # E2E tests and shared test infrastructure
├── .github/                      # CI/CD, PR templates, CODEOWNERS
├── certs/                        # Local TLS (gitignored)
├── docs/                         # Additional documentation
└── [config files]                # tsconfig, eslint, prettier, etc.
```

---

## Module Architecture

### Root Module

The root module composes all feature and infrastructure modules:

```typescript
@Module({
  imports: [
    // Infrastructure
    ObjectConfigModule.forRoot({
      configFactory: appConfigFactory,
      requiredEnvironmentVariables,
    }),
    HttpModule,
    RedisClientModule.forRootAsync({
      imports: [ObjectConfigModule],
      useFactory: (config: ObjectConfigService<AppConfig>) => config.config.redis,
      inject: [ObjectConfigService],
    }),

    // Feature modules
    DataReconciliationModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [AggregatorController],
  providers: [
    AggregatorService,
    BulldogService,
    UpgradeService,
    MonevoService,
  ],
})
export class AppModule {}
```

**Principles:**
- Infrastructure modules (config, Redis, HTTP, auth) are imported first.
- Feature modules are self-contained and export only what consumers need.
- The root module is the composition root — it wires things together but contains no business logic.

### Feature Modules

Each feature is a self-contained module with its own controller, service, DTOs, and exceptions:

```typescript
@Module({
  controllers: [DataReconciliationController],
  imports: [
    BulldogIntegrationModule,
    KnockoutIntegrationModule,
    MonevoIntegrationModule,
    UpgradeIntegrationModule,
    GlobalModule,
    ValidationModule,
  ],
  providers: [
    DataReconciliationService,
    ProcessorFactory,
    BaseplateService,
  ],
  exports: [DataReconciliationService],
})
export class DataReconciliationModule {}
```

**Rules:**
- Modules **import** what they need and **export** only what consumers should access.
- Business logic lives in services, not controllers.
- Controllers are thin — validation, auth guards, and delegation to services.

---

## Dependency Injection Patterns

### Constructor Injection (Standard)

```typescript
@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);

  constructor(
    private readonly bulldogService: BulldogService,
    private readonly upgradeService: UpgradeService,
    private readonly newRelic: NewRelicService,
  ) {}
}
```

### Dynamic Module Registration

For configurable infrastructure, use `forRoot` / `forRootAsync` / `forFeature`:

```typescript
// Root-level singleton
RedisClientModule.forRootAsync({
  imports: [ObjectConfigModule],
  useFactory: (config: ObjectConfigService<AppConfig>) => config.config.redis,
  inject: [ObjectConfigService],
})

// Feature-scoped instance
RedisFeatureModule.forFeatureAsync({
  useFactory: (config: ObjectConfigService<AppConfig>) =>
    config.config.cache.auth.redis,
  inject: [ObjectConfigService],
})
```

### Configurable Module Builder

Use Nest's `ConfigurableModuleBuilder` for typed dynamic modules:

```typescript
import { ConfigurableModuleBuilder } from '@nestjs/common';

export const {
  ConfigurableModuleClass,
  ASYNC_OPTIONS_TYPE,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<RedisClientModuleOptions>().build();
```

Then extend in the module:

```typescript
@Global()
@Module({})
export class RedisClientModule extends ConfigurableModuleClass {
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      module: RedisClientModule,
      providers: [
        { provide: MODULE_OPTIONS_TOKEN, useValue: options },
        RedisClient,
        RedisClientService,
      ],
      exports: [RedisClient, RedisClientService],
    };
  }
}
```

Use `.setClassMethodName('forFeature')` for feature-scoped modules:

```typescript
new ConfigurableModuleBuilder<Options>()
  .setClassMethodName('forFeature')
  .build();
```

---

## Decoupled Integration Pattern

### The Problem

Multiple external integrations with different APIs, data shapes, and behaviors need to be orchestrated uniformly.

### The Solution: Interface + Factory + Strategy

#### 1. Define the Contract

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

**Key:** Generics allow each implementation to define its own request/response/data types while conforming to the same contract.

#### 2. Implement Per-Integration

Each integration lives in its own directory with its own module:

```typescript
// integrations/bulldog/bulldog.service.ts
@Injectable()
export class BulldogService implements ILenderService<BulldogRequest, BulldogResponse, BulldogProduct> {
  readonly IntegrationId = IntegrationId.Bulldog;
  readonly IntegrationCode = 'BULLDOG';
  readonly IntegrationName = 'Bulldog';

  async formatRequest(request: AggregatorRequest): Promise<BulldogRequest> { /* ... */ }
  async requestOffers(request: BulldogRequest): Promise<BulldogResponse> { /* ... */ }
  async formatResponse(response: BulldogResponse): Promise<QuestResponse<BulldogProduct>> { /* ... */ }
}
```

#### 3. Route via Map (Aggregator Pattern)

```typescript
@Injectable()
export class AggregatorService {
  private readonly IntegrationMap: Map<IntegrationId, ILenderService>;

  constructor(
    private readonly bulldogService: BulldogService,
    private readonly upgradeService: UpgradeService,
  ) {
    this.IntegrationMap = new Map<IntegrationId, ILenderService>([
      [IntegrationId.Bulldog, this.bulldogService],
      [IntegrationId.Upgrade, this.upgradeService],
    ]);
  }

  async aggregateOffers<T>(request: AggregatorRequest): Promise<Response<T>> {
    const products = await Promise.all(
      request.integrationIds.map((id) => this.fetchOffers(id, request)),
    ).then((results) => results.flat());

    return { products };
  }
}
```

#### 4. Route via Factory (Processor Pattern)

For more complex dispatching with a switch:

```typescript
@Injectable()
export class ProcessorFactory {
  constructor(
    private readonly bulldogProcessor: BulldogIntegrationService,
    private readonly monevoProcessor: MonevoIntegrationService,
    private readonly upgradeProcessor: UpgradeIntegrationService,
  ) {}

  getProcessor(integrationCode: string): IntegrationProcessor | null {
    switch (integrationCode.toUpperCase()) {
      case INTEGRATION_CODES.BULLDOG:
        return this.bulldogProcessor;
      case INTEGRATION_CODES.MONEVO:
        return this.monevoProcessor;
      case INTEGRATION_CODES.UPGRADE:
        return this.upgradeProcessor;
      default:
        return null;
    }
  }

  groupProductsByIntegration<T>(products: Product<T>[]): Map<string, Product<T>[]> {
    // Group products by their integration code
  }
}
```

### Adding a New Integration

1. **Create directory:** `integrations/new-vendor/` or `processors/new-vendor/`
2. **Implement the interface:** `NewVendorService implements ILenderService`
3. **Create module:** `NewVendorIntegrationModule` with its own providers
4. **Register:** Add to the Map/Factory and import the module
5. **Add test case:** `test/test-cases/new-vendor.ts` and export from barrel
6. **Document:** `processors/new-vendor/README.md`

Unknown integrations return `null` from the factory and are **skipped** (not thrown) — the system is resilient to partial failures.

---

## Error Handling Patterns

### Domain Exceptions

Extend framework exception classes. Name them after the failure domain, not the HTTP status:

```typescript
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

### Graceful Degradation

When one integration fails, others should still succeed:

```typescript
async fetchOffers<T>(integrationId: IntegrationId, request: Request): Promise<Product<T>[]> {
  const service = this.IntegrationMap.get(integrationId);

  if (!service) {
    this.logger.error(new IntegrationNotFoundException(integrationId));
    return [];  // Graceful — don't fail the whole request
  }

  try {
    const formatted = await service.formatRequest(request);
    const response = await service.requestOffers(formatted);
    return (await service.formatResponse(response)).products;
  } catch (error) {
    this.logger.error(error);
    return [];  // Graceful — return empty products for failed integration
  }
}
```

**Pattern:** Wrap each phase (format request, call API, format response) in its own try/catch to capture granular error context for observability while still degrading gracefully.

---

## Configuration Management

### Typed Config Factory

```typescript
export interface AppConfig {
  port: number;
  redis: RedisConfig;
  auth: AuthConfig;
  integrations: IntegrationConfig;
}

export const appConfigFactory = (): AppConfig => ({
  port: env('PORT', 3000),
  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: env('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD'),
  },
  // ...
});

export const requiredEnvironmentVariables = [
  'AUTH0_DOMAIN',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
];
```

**Principles:**
- Config is a **typed object**, not scattered `process.env` calls.
- Required vars are declared explicitly and validated at startup.
- Defaults are provided for local development.
- Nested config interfaces reflect logical grouping (redis, auth, integrations).

---

## Library Design (Internal Packages)

### Nest Monorepo-Style Libraries

Libraries live in `libs/` with their own `tsconfig.lib.json`:

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/my-lib"
  }
}
```

### Library Levels

| Level | Example | Purpose |
|-------|---------|---------|
| **Shared infrastructure** | `redis-client` | Low-level, framework-like, `@Global()`, `forRoot` |
| **Feature library** | `redis-feature` | Builds on infrastructure, `forFeature`, scoped |
| **Domain handler** | `data-reconciliation` | Business logic, owns its own processors |

### Public API Control

Libraries expose a minimal public API through `index.ts`:

```typescript
// Minimal: only module and service
export * from './data-reconciliation.module';
export * from './data-reconciliation.service';
```

```typescript
// Broader: includes mocks for consumer testing
export { RedisClientMock } from './mock/redis-client.mock';
export * from './redis-client.module';
export * from './redis-client.service';
```

**Rule:** Export mocks from library barrels so consumers don't need to reach into internals for testing.

---

## Controller Patterns

### Thin Controllers

Controllers handle HTTP concerns only — auth, validation, serialization, delegation:

```typescript
@ApiTags('Cards')
@Controller('integration')
export class AggregatorController {
  constructor(private readonly aggregatorService: AggregatorService) {}

  @Post('offers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('lead:write')
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Returns offers from requested integrations' })
  @ApiHeader({ name: 'Authorization', description: 'Bearer token (JWT)', required: true })
  @ApiBody({ type: AggregatorRequest })
  @ApiOkResponse({ description: 'Successful response', type: QuestResponse })
  async create(
    @Body() request: AggregatorRequest,
    @Headers() headers: IncomingHttpHeaders,
    @RequestUser() user?: User,
  ): Promise<QuestResponse<any>> {
    return this.aggregatorService.aggregateOffers(request, headers, user);
  }
}
```

**Patterns:**
- **Guards** for auth (`JwtAuthGuard`, `PermissionsGuard`).
- **Pipes** for validation (`ValidationPipe` triggers `class-validator`).
- **Swagger decorators** for API documentation.
- **`@HttpCode`** when the default doesn't match (e.g., POST returning 200 not 201).
- The method body is a single delegation call.

---

## Summary Checklist

- [ ] Feature modules are self-contained with controller, service, DTOs, exceptions
- [ ] Root module is a composition root with no business logic
- [ ] External integrations implement a shared interface
- [ ] Routing uses Map or Factory pattern for extensibility
- [ ] Unknown/failed integrations degrade gracefully (return empty, don't throw)
- [ ] Config is typed, factory-built, with declared required env vars
- [ ] Libraries use `forRoot`/`forFeature` for configurable DI
- [ ] Library barrel exports expose minimum surface area
- [ ] Controllers are thin — guards, validation, delegation only
- [ ] Each integration has its own directory, module, types, and README
