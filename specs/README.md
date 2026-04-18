# TypeScript Project Standards

Portable spec files for building production-grade TypeScript projects. Extracted from a battle-tested NestJS codebase.

## How to Use

**For humans:** Read the spec files relevant to your current work. Each is self-contained with examples.

**For AI agents:** Start with `CLAUDE.md`. It provides a phased refactoring plan with priorities and references the other specs for details.

## Specs

| File | What It Covers |
|------|---------------|
| [CLAUDE.md](./CLAUDE.md) | Agent-facing refactoring guide with priorities, phases, anti-patterns, and verification |
| [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) | tsconfig, ESLint 9, Prettier, type system (interface vs type vs class vs enum), imports, path aliases |
| [TESTING-STANDARDS.md](./TESTING-STANDARDS.md) | Jest config, unit/E2E patterns, mocking strategies, factories, snapshots, coverage, lint-staged |
| [PROJECT-ARCHITECTURE.md](./PROJECT-ARCHITECTURE.md) | Module structure, DI patterns, decoupled integrations, strategy/factory, error handling, config |
| [DOCUMENTATION-STANDARDS.md](./DOCUMENTATION-STANDARDS.md) | README hierarchy, JSDoc/TSDoc, Swagger, PR templates, changelogs, testing guides |
| [DEVOPS-AND-WORKFLOWS.md](./DEVOPS-AND-WORKFLOWS.md) | CI/CD, Docker multi-stage, Husky, commitlint, semantic-release, Dependabot, editor config |

## Quick Start for Refactoring

1. Copy the `specs/` directory into the target project
2. Give the AI agent `CLAUDE.md` as context
3. Work through the phases in order (Foundation → Structure → Types → Testing → Docs → DevOps)
4. Each phase leaves the codebase in a working state

## Stack Assumptions

These specs assume:
- **Runtime:** Node.js (LTS)
- **Language:** TypeScript 5+
- **Framework:** NestJS (but most patterns apply to any TS backend)
- **Testing:** Jest with ts-jest
- **Linting:** ESLint 9 (flat config) + Prettier
- **Package Manager:** npm
- **CI:** GitHub Actions
- **Commits:** Conventional Commits
- **Releases:** semantic-release

Adapt framework-specific patterns (NestJS modules, decorators) to your framework of choice. The principles (modularity, typed config, factory pattern, test infrastructure) are universal.
