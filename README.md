# rfc.akl.run

A statically generated explainer site for the Internet's RFCs. Every RFC number from 1 to the latest gets a permanent page at `rfc.akl.run/<n>/`; the ones that have been written up get plain-language summaries, diagrams and interactive packet and sequence viewers. Everything is pre-rendered HTML: no server code, no runtime services, no third-party requests.

The nightly build reads the RFC Editor index, merges it with the hand-written JSON in `content/`, and renders about 10,000 RFC pages (plus a static search index) into `dist/` in under a minute with Astro 7.

## The coverage ladder

Every RFC climbs the same ladder, and each page states its own level.

| Level | What the page has | How it gets there |
|---|---|---|
| Index | Title, authors, status, abstract, lineage, backlinks, prev/next | Automatic, from the RFC Editor index |
| Summary | Plain-language summary, ELI5 paragraph, area, curated questions | One small JSON file in `content/rfcs/` |
| Explainer | Sections, glossary terms, at least one diagram, references | Larger reviewed JSON file |
| Interactive | Packet inspector or sequence simulator from the viz library | `viz` blocks in the same JSON file |

`/coverage/` is the public progress report.

## Local development

Built with Astro 7 (static output, TypeScript). Requires Node >= 22.22.

```sh
npm ci
npm run dev            # Astro dev server with HMR
npm run build          # fetches (and caches) the RFC Editor index, writes dist/
npm run build:offline  # RFC_OFFLINE=1: uses the cached .cache/rfc-index.xml, no network
npm run preview        # serves dist/ locally
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Vitest: unit tests plus Astro component tests (Container API) |
| `npm run lint` | Content lint (Zod schemas, cross-references, viz rendering and anchors, permalink lock, HTML sanitizer). `--offline` skips the index fetch; `--only <file>` lints specific files |
| `npm run check` | Verifies `dist/`: links, anchors, that every sitemap URL resolves to a file, size budgets (JS counted with its statically imported chunks), that `404.html`, `404/index.html`, `_redirects` and `_headers` exist (and no `not-found/` dir), the Cloudflare file-count limit and `_redirects` rule limits |
| `npm run check:types` | `astro check` (TypeScript and Astro diagnostics) |
| `npm run parity` | Dev tool: structural comparison of `dist/` pages against a golden directory (see below) |
| `npm run deploy` | Build, check, then `wrangler deploy` (CI does this nightly) |

The scripts run TypeScript through `node --import tsx`, which works everywhere (the `tsx` CLI itself can fail in sandboxes that block its IPC socket).

With Nix: `nix develop` gives a shell with Node 22 and Python 3; `nix run` runs `npm ci && npm run build && npm run preview` in the working tree.

### Parity tool

`scripts/parity.ts` compares built pages with the output of the pre-Astro generator and prints a similarity score per page. It is only useful while checking a migration or large template change. Produce a golden directory by building the reference revision (the commit before the Astro port, `f4acaf5`, with `node scripts/build.js --out .work/golden`), then:

```sh
node --import tsx scripts/parity.ts [paths...] [--golden .work/golden] [--dist dist] [--full]
```

The golden directory defaults to `.work/golden` (git-ignored).

## Content authoring

Content lives in `content/` as JSON and is loaded through Astro content collections (`src/content.config.ts`: `rfcs`, `journeys`, `glossary`). Every file is validated at build time with the Zod schemas in `src/lib/schemas.ts`, which are the source of truth for the shape (the same schemas power `npm run lint`). A bad file fails the build with the collection, id and field path.

- RFC files: `content/rfcs/<n>.json` (plain number, e.g. `content/rfcs/903.json`; no zero-padding). Start from an existing file of similar level.
- Journeys: `content/journeys/<slug>.json`. Glossary terms: `content/glossary/<term-id>.json`.
- Optional signals: `content/signals/demand.json` (written by CI from `explainer-request` issues) and `traffic.json`.
- **Permalink lock:** section ids become URL anchors (`/903/#how-it-works`). `content/section-ids.lock.json` records every published id, and lint fails if one disappears. After adding sections, run `node --import tsx scripts/lint-content.ts --update-lock` and commit the lock. Never rename a published id.
- **Sanitizer:** every HTML field (`summary`, `today`, `eli5`, section `content`/`eli5`, glossary `definition`) is checked against an allowlist of tags and attributes (`src/lib/sanitize-check.ts`). Both lint and the build run the check and fail on violations.
- **Provenance policy:** LLM-drafted content is always labeled. A machine-drafted file carries `provenance.source = "llm-draft"` and `provenance.reviewedBy = null`, and its page shows "Draft · machine-assisted, not yet reviewed". A human must review the content against the RFC text before `reviewedBy` is set. Nothing is generated at request time.

## Project structure

```
content/              Hand-written JSON: rfcs/, journeys/, glossary/, signals/, section-ids.lock.json
src/
  content.config.ts   Content collections (glob loaders + Zod schemas)
  pages/              Routes: [n].astro (every RFC), index (Atlas), areas/, journeys/, glossary/, graph/,
                      coverage/, contribute/, not-found.astro (built to dist/404.html), data/ and feed/sitemap/robots endpoints
  components/         Astro components: chrome/, rfc/, atlas/, viz/ (packet and sequence viewers, diagrams)
  layouts/            BaseLayout.astro
  lib/                Site model, RFC index loader, schemas, sanitizer, search index, data-file builders
  integrations/       build-files.ts: writes _redirects, _headers and 404.html after the build
  scripts/            Browser scripts (theme, search, atlas, graph, packet, sim, reader)
  styles/             CSS
scripts/              CLI tools run with node --import tsx: lint-content, check-dist, parity,
                      fetch-demand, coverage-diff, import-summaries, merge-glossary, make-summary-batches
test/                 Vitest suites and fixtures
docs/                 Design and build specs
.github/workflows/    ci.yml (PRs and trunk), nightly.yml (build + deploy)
```

## Deploy

Hosting is Cloudflare Workers static assets (free plan), configured by `wrangler.jsonc` (assets-only Worker `rfc-akl-run` serving `dist/`, custom 404 page, `auto-trailing-slash`). `.github/workflows/nightly.yml` builds daily at 06:17 UTC (and on demand) and, on `trunk` only, runs `npx wrangler@4.151.0 deploy`. Static asset requests are free and unlimited.

### Why file count matters

The free plan allows 20,000 files per deployed version (100,000 on Paid) and 25 MiB per file. Every RFC is one `<n>/index.html`, so `dist/` is about 10.2k files today. To stay well under the limit, the build emits no per-RFC redirect stubs and no sharded search chunks; redirects live in a generated `_redirects` file and caching in a generated `_headers` file (both written by `src/integrations/build-files.ts`). RFCs grow by about 300 per year, so the headroom is decades. `scripts/check-dist.ts` fails the build at 20,000 files, warns at 18,000, and checks `_redirects` against the 2,000 static / 100 dynamic rule caps.

### Redirects and caching

- `/rfc903` -> `/903/` comes from `_redirects` (`/rfc:num /:num/ 301`). This placeholder-in-segment form should be verified on a preview deploy (`npx wrangler@4.151.0 versions upload`); if it does not match, delete the rule. It is optional, since the old site never had `/rfcN` URLs.
- Legacy `/#rfcNNN` links are forwarded to `/NNN/` by the Atlas page's inline script.
- Slug aliases for explainers (`/<slug>` -> `/<n>/`) are also in `_redirects`.
- `_headers`: `/assets/*` is `public, max-age=31536000, immutable`; everything else (HTML, `data/`) is `public, max-age=300`; the static search index under `data/search/` is `max-age=60` since its file names are not hashed. Cloudflare handles edge caching for static assets itself.
- `www` -> apex is a Cloudflare dashboard setting (Redirect Rule), not part of this repo.

### One-time owner setup

1. Create the Worker `rfc-akl-run` (the first `npx wrangler@4.151.0 deploy` creates it) or reuse the existing one under the same name.
2. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` (token with the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`.
3. In the Cloudflare dashboard, Workers & Pages > `rfc-akl-run` > Settings > Domains & Routes: add the custom domain `rfc.akl.run` (and `www` if wanted, redirecting to the apex).
4. **Disable any existing Cloudflare Git-integration build** for this repo that runs the old `wrangler deploy --assets=./site`; `site/` no longer exists and it will fail or deploy stale content. (Alternative: set its build command to `npm ci && npx astro build` and its deploy command to `npx wrangler deploy`. The recommended path is GitHub Actions only.)
5. The Worker name `rfc-akl-run` matches the one the old site deployed to, so `wrangler deploy` updates it in place and an existing `rfc.akl.run` custom domain keeps working; nothing to migrate.
6. Create the GitHub label `explainer-request` so `scripts/fetch-demand.ts` has something to read.

RFC text is (c) IETF Trust; explanations are on rfc.akl.run.
