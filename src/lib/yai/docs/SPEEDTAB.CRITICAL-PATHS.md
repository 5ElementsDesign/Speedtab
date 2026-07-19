# Speedtab Critical Paths

Last updated: 2026-07-16

This file exists to stop feature work from breaking stable mechanics that were already solved.

## 1. Favicon Resolution

Canonical reference:

- `favicon.1.4.301.js`
- live file: `src/next/utils/favicon.js`

### Why the restored version works

The working favicon resolver is intentionally simple.

It works because it does this:

1. Normalize the URL to a hostname.
2. Resolve favicon assets by hostname only.
3. Allow a limited parent-host fallback only after an exact-host lookup misses.
4. Fetch from the favicon service using the hostname candidates.
5. Deduplicate by checksum and merge hostname aliases into asset metadata.

It does **not** try to be clever with page scraping, HTML parsing, custom icon discovery, source URL tracking, abort trees, or multi-stage network fallbacks.

That simplicity is why the following work reliably:

- subdomain favicon separation like:
  - `www.google.com`
  - `gemini.google.com`
  - `maps.google.com`
- parent-host fallback only when the subdomain truly has no own asset
- localhost / `.loc` exclusion behavior
- cached blob reuse through `aliasByHost`

### Invariants: do not change these casually

#### Hostname normalization

- Keep `normalizeFaviconHostname()` behavior stable.
- Keep `www.` stripping.
- Keep `.loc` and `localhost` exclusion behavior exactly as in the known-good version.

#### Candidate resolution

- `getHostnameCandidates(hostname)` must remain minimal:
  - exact hostname first
  - one parent fallback for deeper subdomains
- Do not expand this into broad hostname collapsing.
- Do not let sibling subdomains inherit each other’s icons.

#### Fetch strategy

- The known-good version uses only the favicon service:
  - `https://icons.duckduckgo.com/ip3/{hostname}.ico`
- Do not prepend custom fetch stages without dedicated tests.
- Especially do not insert:
  - page HTML scraping
  - `link[rel*=icon]` crawling
  - direct `/favicon.ico` probing
  - source URL heuristics

Those changes reintroduced the Google subdomain bug.

#### Alias behavior

- `aliasByHost` is only a cache convenience.
- It must not become a broad canonical remapping layer.
- Exact host remains authoritative.
- Parent-host fallback is only allowed when exact host has no own cached asset.

#### Persistence

- `meta_json.hostnames` is the source of truth for favicon ownership.
- Any change to asset deduplication must preserve hostname lists.
- If checksum deduplication merges records, merged hostname coverage must survive.

### What broke on 2026-07-16

The broken version added:

- HTML fetching
- icon extraction from page markup
- custom timeout logic
- source URL tracking
- extra MIME sniffing / coercion in the fetch path
- reordered resolution stages

That made the resolver “smarter”, but less stable.

The concrete regression:

- Google subdomains collapsed back to the same favicon.

### Rule for future favicon work

If you change `src/next/utils/favicon.js`, you must do all of this first:

1. Compare against `favicon.1.4.301.js`.
2. Explain why the new behavior is necessary.
3. Prove that these still remain distinct:
   - `https://www.google.com/`
   - `https://gemini.google.com/`
   - `https://maps.google.com/`
4. Verify parent fallback still works when a subdomain has no own favicon.
5. Run:
   - `npm run test -- src/composables/useMaintenance.test.ts src/next/tests/bookmarks.test.ts`
   - `npm run build`

If that proof is missing, do not merge the change.

## 2. Module Grid / Column Span

This also broke on 2026-07-16.

### Why the grid is fragile

The module layout is already solved and must remain a real 12-column grid.

The moment the page-grid path gets mixed with flex-basis sizing, inline `max-width`, or alternate row layout models, modules start:

- overflowing the viewport
- shrinking inside wrappers
- ignoring saved column spans
- wrapping at the wrong counts

### Invariants

#### Layout model

- Desktop page layout must remain grid-based.
- Do not replace the module page grid with a flex layout.
- Do not add fallback flex sizing to `data-grid-col` on the main page grid path.

#### Column span source of truth

- Module span must come from the actual stored module config / stored UI override.
- Do not merge default effective UI config back into fresh module render data before row grouping.
- Defaults are for missing values, not for overwriting explicit module creation choices.

#### Inline style hygiene

For `data-grid-col`, do not inject:

- `flex`
- `max-width`
- `--st-grid-col-basis`

on the main page grid path.

The valid placement data is:

- `--st-grid-col-span`
- `--st-grid-col-track`
- `grid-column`

### What broke on 2026-07-16

These caused the regressions:

- changing desktop rows from grid to flex
- adding inline flex/max-width sizing to grid columns
- grouping rows before stored UI span overrides were attached
- accidentally forcing new modules back to default span `6`

### Rule for future grid work

If you touch module/page layout:

1. Do not change the layout model unless explicitly requested.
2. Preserve the 12-column grid path.
3. Verify all of these before considering the work safe:
   - `12` spans full width
   - `6 + 6` fits one row
   - `4 + 4 + 4` fits one row
   - a lone final module with `< 12` may be centered only if requested
4. Verify no inline flex/max-width residue is written onto `data-grid-col`.

## 3. General Rule For Feature Agents

Do not “improve” solved infrastructure just because a more advanced approach seems possible.

For Speedtab, that is often exactly how regressions start.

If a mechanism is already stable:

- preserve it
- patch around it
- do not replace its model unless the task explicitly asks for that

When in doubt:

1. identify the known-good file
2. explain what invariant makes it work
3. change the smallest possible surface
4. stop
