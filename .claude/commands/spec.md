---
description: Generate a detailed feature spec file and git branch from a short idea
argument-hint: Short feature description (e.g. "add rate limiting to auth endpoints")
allowed-tools: Read, Write, Glob, Bash(git switch:*, git branch:*, git status:*, git stash:*, git add:*, git commit:*, git push:*, gh pr create:*)
---

You are helping spin up a new feature spec for this TypeScript backend application, from a short idea provided in the user input below. Always adhere to any rules or requirements set out in any CLAUDE.md files when responding.

User input: $ARGUMENTS

## High level behavior

Your job is to turn the user input above into:

- A human-friendly feature title in kebab-case (e.g. `rate-limiting-auth-endpoints`)
- A safe git branch name not already taken (e.g. `feature/rate-limiting-auth-endpoints`)
- A detailed markdown spec file saved under the `_specs/` directory

Then switch to a new git branch, save the spec file to disk, commit and push the branch, open a PR with a generated description, and print a short summary of what you did.

---

## Step 1. Check the current branch

Run `git status` and abort this entire process if there are any uncommitted, unstaged, or untracked files in the working directory. Tell the user to commit or stash changes before proceeding, and DO NOT GO ANY FURTHER.

---

## Step 2. Parse the arguments

From `$ARGUMENTS`, extract:

1. `feature_title` — a concise, human-readable title in title case (e.g. `Rate Limiting Auth Endpoints`)
2. `feature_slug` — a kebab-case slug derived from the feature title (e.g. `rate-limiting-auth-endpoints`)
3. `branch_name` — formatted as `feature/<feature_slug>` (e.g. `feature/rate-limiting-auth-endpoints`)
4. `spec_filename` — formatted as `_specs/<feature_slug>.md`

If you cannot infer a sensible `feature_title` and `feature_slug`, ask the user to clarify instead of guessing.

If no arguments were provided, stop and ask the user to re-run the command with a short feature description.

---

## Step 3. Switch to a new Git branch

Before creating any content, check for branch conflicts by running `git branch -a`. If `branch_name` already exists, append a numeric suffix to make it unique (e.g. `feature/rate-limiting-auth-endpoints-01`).

Then switch to the new branch:

```bash
git switch -c <branch_name>
```

If the branch creation fails for any reason, report the error clearly and DO NOT GO ANY FURTHER.

---

## Step 4. Read the project for context

Before writing the spec, gather relevant context:

1. Read `CLAUDE.md` if it exists — note any conventions, patterns, or constraints that should influence the spec
2. Glob for `_specs/*.md` — read 1–2 existing specs to understand the team's preferred level of detail and formatting style
3. Glob for relevant source files related to the feature area (e.g. route handlers, services, middleware) — skim them to understand current conventions and surface integration points

Use this context to make the spec accurate and grounded in how the codebase actually works.

---

## Step 5. Draft the spec content

Write a thorough spec to `spec_filename` with the following structure. Adjust section depth and length based on feature complexity — simple features can be concise, complex features should be detailed.

```markdown
# <Feature Title (human readable, title case)>

## Summary

One paragraph describing what this feature does, why it's needed, and the expected outcome. Be specific — avoid vague language like "improve performance" without explaining how.

## Background & Motivation

- Why is this feature being built? What problem does it solve?
- Are there any prior attempts, related issues, or upstream dependencies?
- Who is the intended user or caller (internal service, external API consumer, cron job, etc.)?

## Goals

A focused list of what success looks like for this feature:

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

## Non-Goals

Explicitly state what this feature will NOT do to prevent scope creep:

- Not handling X
- Not replacing Y
- Deferred to a future spec: Z

## Technical Design

### Overview

High-level summary of the approach. What components are involved? What changes are required?

### Data Model Changes

Describe any new or modified database tables, columns, or indexes. Include field names, types, nullability, and rationale. If no DB changes are needed, write "None."

### API / Interface Changes

For each new or modified endpoint or function:

**`METHOD /path/to/endpoint`**

- Description: What does it do?
- Auth: Who can call it? What permissions are required?
- Request: Describe request body or query params with types
- Response: Describe success and error shapes
- Side effects: Any events emitted, jobs enqueued, caches invalidated?

### Service / Business Logic

Describe the core logic in plain language. Walk through the happy path step by step, then call out edge cases and how they're handled.

### Error Handling

| Scenario             | Expected Behavior                          |
| -------------------- | ------------------------------------------ |
| Invalid input        | Return 400 with descriptive error message  |
| Unauthorized caller  | Return 401/403                             |
| Downstream failure   | Return 502, log error, do not retry inline |
| Unexpected exception | Return 500, alert on-call                  |

### Observability

- **Logging**: What should be logged and at what level? Include key fields (e.g. `userId`, `requestId`).
- **Metrics**: Any counters, histograms, or gauges to emit?
- **Alerts**: Should any thresholds trigger an alert?

## Implementation Plan

A step-by-step breakdown of how to build this, ordered by dependency. Each step should be small enough to review independently.

- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Step 3: ...
- [ ] Step 4: Write unit tests
- [ ] Step 5: Write integration tests
- [ ] Step 6: Update documentation / OpenAPI schema
- [ ] Step 7: Deploy to staging and verify

## Testing Strategy

Describe what needs to be tested and at what level:

- **Unit tests**: Which functions or classes need coverage? What edge cases must be exercised?
- **Integration tests**: Which flows need end-to-end coverage? What external dependencies need mocking?
- **Manual QA**: Any scenarios that are hard to automate?

## Open Questions

List anything that needs a decision before or during implementation:

- [ ] Q1: ...
- [ ] Q2: ...

## Out of Scope / Future Work

- Item deferred to a follow-up spec or ticket
- Known limitation that will be addressed later

## References

- Related specs: `_specs/...`
- Related PRs or tickets: (if known)
- Relevant docs or RFCs: (if applicable)
```

---

---

## Step 6. Commit and push the branch

Stage and commit the spec file:

```bash
git add _specs/<feature_slug>.md
git commit -m "feat: add spec for <feature_title>"
```

Then push the branch to origin:

```bash
git push -u origin <branch_name>
```

If the push fails, report the error clearly and skip the PR step — do not attempt to force push.

---

## Step 7. Open a pull request

Using the GitHub CLI, create a draft PR against the default branch (typically `main` or `develop` — check `git remote show origin` if unsure):

```bash
gh pr create \
  --title "<feature_title>" \
  --body "<pr_description>" \
  --draft \
  --base <default_branch>
```

Generate `pr_description` using the following template, populated from the spec you just wrote:

```markdown
## Summary

<One paragraph from the spec Summary section>

## What changed

<Bulleted list of the key changes described in Technical Design>

## Testing

<Brief summary from the Testing Strategy section>

## Notes

- Spec file: `_specs/<feature_slug>.md`
- This PR is a draft — spec is ready for review before implementation begins.
```

If the `gh` CLI is not available or the user is not authenticated, skip this step and tell the user to open the PR manually.

---

## Step 8. Final output to the user

After the PR is created, respond to the user with a short summary in this exact format:

```
Branch:    <branch_name>
Spec file: _specs/<feature_slug>.md
Title:     <feature_title>
PR:        <pull_request_url>
```

Do not repeat the full spec in the chat output unless the user explicitly asks to see it. The main goal is to save the spec file, push the branch, open a draft PR, and report where everything lives.
