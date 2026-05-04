## What this PR does

<!-- One-paragraph summary. Reviewers shouldn't need to read the diff to
get the gist. -->

## Linked issue

<!-- Closes #123 / Refs #456 — required unless this is purely refactoring. -->

## Type of change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Docs / refactor / chore (no behavior change)
- [ ] New site selector (please link the site request issue)

## Tests

- [ ] I added or updated unit tests
- [ ] I added or updated integration / e2e tests
- [ ] `npm test` passes locally
- [ ] `npm run test:e2e` passes locally (or this PR doesn't change e2e
      surface)

## Docs

- [ ] User-visible behavior change → README updated
- [ ] Architecture / detection / mode change → relevant `docs/*.md`
      updated

## Manual testing

<!-- Describe what you tested by hand. Which sites? Which mode? Which
browser? -->

## Checklist

- [ ] Conventional commit messages
- [ ] No `console.log` in production code (use `lib/logger.ts`)
- [ ] No `any` types added without justification
- [ ] Bundle size still under 800KB (`npm run build`)
