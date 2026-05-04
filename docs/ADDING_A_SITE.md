# Adding a known site

If a site has stable, well-documented upload constraints, please contribute
it. New sites take ~10 lines of code, a fixture, and a test.

## Steps

1. **Add an entry to `src/lib/known-sites.ts`:**

   ```ts
   {
     id: 'figma',
     hosts: ['figma.com'],
     pathIncludes: ['/board/', '/design/'],
     constraints: {
       width: 800,
       height: 800,
       acceptedFormats: ['image/png', 'image/jpeg'],
       maxSizeBytes: 4 * 1024 * 1024,
       label: 'Figma cover image',
       source: 'known-site',
       siteId: 'figma',
     },
   },
   ```

   Notes:
   - `id` is lowercase, kebab-case, must be unique.
   - `hosts` matches against bare hostnames or any subdomain. List the
     primary domain only (we already match subdomains).
   - `pathIncludes` is optional; use it to restrict to a specific page
     (e.g. GitHub avatar lives under `/settings/profile`).
   - `domSelectors` is optional; use it when path alone isn't enough.

2. **Add a fixture HTML page in `tests/fixtures/sites/<site-id>.html`** so
   integration tests can run without hitting the live site. Real sites
   change — fixtures keep our tests deterministic.

3. **Add a test** in `src/lib/known-sites.test.ts` proving the URL matches.

4. **Update README** under "Supported sites" with the new row.

5. **Manually verify** end-to-end on the live site:
   - Detection banner shows the correct constraints.
   - Each mode's exported file matches the dimensions.
   - "Try insert" works (or document if it doesn't, e.g. some sites use
     synthetic events that block DataTransfer).

6. **Open a PR.** Use the standard PR template; mention which mode + flow
   you tested manually.

## Why this matters

The known-sites list is the difference between "Inputr works on the site I
care about" and "Inputr maybe works." We accept site PRs eagerly — but
fixtures + tests are required so the list doesn't rot.
