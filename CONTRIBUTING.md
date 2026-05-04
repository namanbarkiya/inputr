# Contributing to Inputr

First — thank you. Inputr aims to be the kind of free, well-maintained
extension that developers install once and forget. That bar requires hygiene
on every PR. This file explains exactly what we expect.

## Table of contents

- [Dev setup](#dev-setup)
- [Running it](#running-it)
- [Tests](#tests)
- [Coding standards](#coding-standards)
- [Submitting a PR](#submitting-a-pr)
- [Adding a known site](#adding-a-known-site)
- [Adding a new mode](#adding-a-new-mode)
- [Code of Conduct](#code-of-conduct)

## Dev setup

```bash
git clone https://github.com/inputr/inputr.git
cd inputr
npm install
```

Node 20+ is required. There's a `.nvmrc` if you use `nvm`.

## Running it

```bash
npm run dev          # launches Chrome with hot reload
npm run dev:firefox  # Firefox dev profile
npm run build        # production build to .output/
npm run zip          # produces a Chrome-Web-Store-ready .zip
```

`npm run dev` opens a fresh Chrome profile with the extension preloaded.
Edit any file under `src/` or `entrypoints/` and the side panel hot-reloads.

## Tests

```bash
npm test                # unit + integration (Vitest, watch off)
npm run test:watch      # watch mode
npm run test:coverage   # with v8 coverage
npm run test:e2e        # Playwright (builds first; uses a local fixture server)
```

Coverage targets:

- `src/lib/**` — 80%
- `src/modes/**` — 60%

Every utility in `src/lib/` ships with a co-located `*.test.ts`. Every mode
covers happy path + at least 2 error / edge cases.

## Coding standards

- **TypeScript strict.** No `any` without a comment. No `// @ts-ignore`
  without a linked issue.
- **No `console.log` in production code.** Use the `log` utility from
  `src/lib/logger.ts`.
- **Conventional Commits.** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, etc. Enforced by commitlint.
- **Pre-commit hook** auto-runs ESLint + Prettier on staged files. Don't
  bypass it.
- **No remote code, no inline scripts, no `eval`.** MV3 forbids it; so do we.

Run `npm run lint && npm run typecheck` locally before opening a PR.

## Submitting a PR

1. Branch from `main`. Branch name suggestion: `feat/add-figma-site`,
   `fix/cropper-aspect-ratio`.
2. Commit with conventional commits.
3. Add or update tests.
4. Update relevant docs (`docs/`) if your change is user-visible.
5. Open the PR using the template — fill out every section.
6. CI must pass. We don't merge red builds.
7. A maintainer will review within 7 days. Address feedback in additional
   commits, not force-pushes (we squash-merge).

## Adding a known site

If a site has stable, hardcoded upload constraints, please add it to
`src/lib/known-sites.ts`. Step-by-step in
[docs/ADDING_A_SITE.md](./docs/ADDING_A_SITE.md).

## Adding a new mode

Modes implement the contract in `src/types/modes.ts`. See
[docs/ADDING_A_MODE.md](./docs/ADDING_A_MODE.md) for the conventions and a
walkthrough using one of the existing modes as a template.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be
kind, be specific, focus on the work.
