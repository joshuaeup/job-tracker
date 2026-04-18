# DevOps and Workflow Standards

Standards for CI/CD, Docker, git hooks, commit conventions, semantic versioning, dependency management, and developer tooling.

---

## Git Hooks (Husky)

### Setup

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

### Pre-Commit Hook

`.husky/pre-commit`:

```bash
npx lint-staged
```

### Commit Message Hook

`.husky/commit-msg`:

```bash
npx commitlint --edit $1
```

### lint-staged Configuration

In `package.json`:

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

**What runs on every commit:**
1. **Format** — Prettier auto-fixes formatting.
2. **Lint** — ESLint catches code quality issues.
3. **Unit tests** — Only tests related to changed files run.
4. **E2E tests** — Only E2E tests related to changed files run.

`--bail` stops on first failure. `--passWithNoTests` prevents false failures for files without tests.

---

## Commit Conventions

### Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced by `commitlint`:

```
type(scope): description

[optional body]

[optional footer(s)]
```

### Types

| Type | When | Version Bump |
|------|------|--------------|
| `feat` | New feature | Minor |
| `fix` | Bug fix | Patch |
| `docs` | Documentation only | None |
| `style` | Formatting, whitespace | None |
| `refactor` | Code change that neither fixes nor adds | None |
| `perf` | Performance improvement | Patch |
| `test` | Adding/correcting tests | None |
| `chore` | Maintenance, dependencies | None |
| `ci` | CI/CD changes | None |
| `build` | Build system changes | None |

### commitlint Config

`commitlint.config.mjs`:

```javascript
const Configuration = {
  extends: ['@commitlint/config-conventional'],
};

export default Configuration;
```

### Important

When squash-merging PRs, ensure the merge commit title is also conventional format. If it's not, semantic-release workflows will fail.

---

## Semantic Release

### Configuration

`release.config.mjs`:

```javascript
export default {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/git',
    '@semantic-release/github',
  ],
  repositoryUrl: 'https://github.com/org/repo.git',
  tagFormat: '${version}',
};
```

### Pipeline

1. `commit-analyzer` — reads commit messages, determines version bump (major/minor/patch).
2. `release-notes-generator` — generates human-readable release notes.
3. `changelog` — updates `CHANGELOG.md`.
4. `git` — commits changelog changes.
5. `github` — creates a GitHub release with the tag.

### npm Script

```json
{
  "release": "semantic-release"
}
```

---

## CI/CD Workflows

### Checks Workflow (Pull Requests)

`.github/workflows/checks.yml`:

```yaml
name: Checks
on:
  push:
    branches-ignore:
      - main

jobs:
  checks:
    uses: org/shared-workflows/.github/workflows/checks.yml@main
    with:
      node-version: 24
    secrets: inherit
```

**Triggers:** Every push to any branch except `main`.
**Purpose:** Lint, type-check, test, build validation.

### Development Deployment

`.github/workflows/ecs-pipeline-development.yml`:

```yaml
on:
  push:
    branches: [main]
    tags: ['*-rc.*']
  workflow_dispatch:
```

**Triggers:**
- Push to `main` (auto-deploy on merge).
- Tags matching `*-rc.*` (pre-release deploy from feature branches).
- Manual trigger via `workflow_dispatch`.

### Production Deployment

`.github/workflows/ecs-pipeline-production.yml`:

```yaml
on:
  workflow_dispatch:
```

**Triggers:** Manual only. Select the tag to deploy.

### Key Variables and Secrets

Document these in `.github/README.md`:

| Type | Name | Purpose |
|------|------|---------|
| Variable | `GHA_ROLE_ARN_DEV` | AWS role for dev deployment |
| Variable | `GHA_ROLE_ARN_PROD` | AWS role for prod deployment |
| Secret | `ORG_GITHUB_ACTION_TOKEN` | Cross-repo access for shared workflows |

---

## Dependabot

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 10
    versioning-strategy: increase
    groups:
      nestjs:
        patterns: ['@nestjs/*']
      eslint:
        patterns: ['eslint*', '@eslint/*', 'typescript-eslint']
    ignore:
      - dependency-name: '*'
        update-types: ['version-update:semver-patch']
```

**Principles:**
- **Monthly** updates to avoid churn.
- **Grouped updates** — NestJS packages and ESLint packages update together.
- **Ignore patches** — only minor and major version bumps create PRs.
- **Production only** — don't auto-bump devDependencies for version updates.

---

## Docker

### Multi-Stage Dockerfile

```dockerfile
# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install ALL deps (including dev) for building
COPY package*.json ./
COPY .npmrc.example ./.npmrc
ARG REPO_GITHUB_TOKEN
RUN sed -i "s|\${REPO_GITHUB_TOKEN}|${REPO_GITHUB_TOKEN}|g" .npmrc
RUN NODE_ENV=development npm ci

# Build the app
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Runtime
FROM node:24-alpine

# Security: update system packages
RUN apk update && apk upgrade libcrypto3 libssl3 zlib

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE $PORT

CMD ["node", "dist/src/main.js"]
```

**Patterns:**
- **Multi-stage** — build with dev deps, run with production deps only.
- **Alpine base** — minimal image size.
- **Security patching** — `apk upgrade` for known CVE packages.
- **Token substitution** — private registry auth via build arg, not baked into image.
- **`npm prune`** — remove dev deps after build, before copying to runtime stage.

### docker-compose.yml (Local Development)

```yaml
version: '2'
services:
  redis:
    image: redis:alpine
    command: redis-server --requirepass letmein
    ports:
      - '6379:6379'

  redis-commander:
    image: rediscommander/redis-commander:latest
    platform: linux/amd64
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=letmein
    ports:
      - '8081:8081'
    depends_on:
      - redis
```

**Principles:**
- Only infrastructure services (Redis, databases) in `docker-compose.yml`.
- The app itself runs natively for fast iteration (`npm run start:dev`).
- Include admin UIs (redis-commander) for development convenience.
- Use simple, memorable passwords for local dev.

---

## npm Scripts Reference

```json
{
  "prebuild": "rimraf dist",
  "build": "nest build",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\" \"libs/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\" \"libs/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/src/main",
  "start:docker": "docker-compose up -d",
  "stop:docker": "docker-compose stop",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test": "jest --no-watchman",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage --no-watchman --ci --runInBand",
  "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e": "jest --config test/jest-e2e.json --no-watchman",
  "test:e2e:snapshot": "jest --config test/jest-e2e.json --no-watchman -u",
  "prepare": "husky",
  "release": "semantic-release",
  "show-updates:nestjs": "ncu -f '/nestjs/'"
}
```

**Categories:**
- **Build:** `prebuild` (clean), `build` (compile)
- **Run:** `start`, `start:dev` (watch), `start:debug`, `start:prod`
- **Infrastructure:** `start:docker`, `stop:docker`
- **Quality:** `format`, `format:check`, `lint`
- **Test:** `test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e`, `test:e2e:snapshot`
- **Tooling:** `prepare` (husky), `release` (semantic-release), `show-updates:nestjs`

---

## Editor Configuration

### `.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "eslint.format.enable": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

**Principles:**
- Format on save eliminates style arguments.
- Use workspace TypeScript, not global, for consistent behavior.
- ESLint formatting enabled so quick-fixes work.

### `.nvmrc`

```
24
```

Pin Node version so everyone uses the same runtime.

### `.env.example`

Template for required environment variables. Developers copy to `.env`:

```bash
cp .env.example .env
```

Never commit `.env` — only `.env.example` with placeholder/default values.

---

## CODEOWNERS

`.github/CODEOWNERS`:

```
* @org/team-name
```

All PRs require review from the owning team. Scope to specific paths for multi-team repos:

```
/libs/shared-lib/ @org/platform-team
/src/feature/ @org/feature-team
```

---

## Version and Engine Pinning

### `package.json`

```json
{
  "engines": {
    "node": "~24",
    "npm": ">=10"
  }
}
```

### Node Version Files

- `.nvmrc` for local development.
- CI workflows specify the same version.
- Dockerfile `FROM node:24-alpine` matches.

**All three must agree.** When upgrading Node, update all locations.

---

## Summary Checklist

- [ ] Husky hooks: `pre-commit` runs lint-staged, `commit-msg` runs commitlint
- [ ] lint-staged: format, lint, related unit tests, related E2E tests
- [ ] Conventional Commits enforced by commitlint
- [ ] semantic-release auto-generates versions, changelog, and GitHub releases
- [ ] CI: checks on PRs, auto-deploy to dev on merge to main, manual prod deploy
- [ ] Dependabot: monthly, grouped, patch-ignored
- [ ] Docker: multi-stage build, Alpine, security patching, token substitution
- [ ] docker-compose: infrastructure only, app runs natively
- [ ] Editor config: format on save, workspace TypeScript
- [ ] Node version pinned in `.nvmrc`, `package.json` engines, Dockerfile, and CI
- [ ] `.env.example` template committed, `.env` gitignored
- [ ] CODEOWNERS defining review responsibilities
