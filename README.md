# rfc.akl.run

A statically generated explainer site for the Internet's RFCs. Every RFC number from 1 to the latest gets a permanent page at `rfc.akl.run/<n>/`; the ones that have been written up get plain-language summaries, diagrams and interactive packet and sequence viewers. Everything is pre-rendered HTML: no server code, no runtime services, no third-party requests.

The nightly build reads the RFC Editor index, merges it with the hand-written JSON in `content/`, and renders about 10,000 RFC pages (plus a static search index) into `dist/` in a few seconds.

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

Requires Node 22.

```sh
npm ci
npm run build      # fetches (and caches) the RFC Editor index, writes dist/
npm run serve      # http://localhost:8080
```

Useful build flags (`node scripts/build.js ...`):

- `--offline` uses the cached `.cache/rfc-index.xml` and never touches the network (`npm run build:offline`).
- `--only 903,826` renders only those RFC pages, for quick iteration.

Other commands: `npm test`, `npm run lint` (content lint), `npm run check` (verifies `dist/`: links, anchors, that every sitemap URL resolves to a file, size budgets, the Cloudflare file-count limit and `_redirects` rule limits).

With Nix: `nix develop` gives a shell with Node 22 and Python 3; `nix run` runs `npm ci && npm run build && npm run serve` in the working tree.

## Content authoring

- RFC files: `content/rfcs/<n>.json` (plain number, e.g. `content/rfcs/903.json`; no zero-padding). Schema: `content/schema/rfc.schema.json`. Start from an existing file of similar level.
- Journeys: `content/journeys/<slug>.json`. Glossary terms: `content/glossary/<term-id>.json`.
- Optional signals: `content/signals/demand.json` (written by CI from `explainer-request` issues) and `traffic.json`.
- **Permalink lock:** section ids become URL anchors (`/903/#how-it-works`). `content/section-ids.lock.json` records every published id, and lint fails if one disappears. After adding sections, run `node scripts/lint-content.js --update-lock` and commit the lock. Never rename a published id.
- **Lint:** `npm run lint` validates the schema, cross-references, viz rendering, viz anchors and the lock, and checks every HTML field (`summary`, `today`, `eli5`, section `content`/`eli5`, glossary `definition`) against an allowlist of tags and attributes (`scripts/lib/sanitize-check.js`; the build runs the same check and fails on violations). `--offline` avoids fetching the index; `--only <file>` lints specific files.
- **Provenance policy:** LLM-drafted content is always labeled. A machine-drafted file carries `provenance.source = "llm-draft"` and `provenance.reviewedBy = null`, and its page shows "Draft · machine-assisted, not yet reviewed". A human must review the content against the RFC text before `reviewedBy` is set. Nothing is generated at request time.

## Project structure

```
content/            Hand-written JSON: rfcs/, journeys/, glossary/, signals/, schema/, section-ids.lock.json
src/assets/         css/ and js/ sources (plain browser scripts, no bundler)
scripts/
  build.js          Orchestrator: index + content -> dist/
  check-dist.js     Post-build verification and budgets
  lint-content.js   Content lint
  lib/ pages/ templates/   Model, page modules, HTML templates
  fetch-demand.js   GitHub issues -> content/signals/demand.json
  coverage-diff.js  Compares two coverage.json files (nightly summary)
test/               node:test suites and fixtures
docs/design-handoff/  Design and build spec
.github/workflows/  ci.yml (PRs and trunk), nightly.yml (build + deploy)
```

## Deploy

Hosting is Cloudflare Workers static assets (free plan), configured by `wrangler.jsonc` (assets-only Worker `rfc-akl-run` serving `dist/`, custom 404 page, `auto-trailing-slash`). `.github/workflows/nightly.yml` builds daily at 06:17 UTC (and on demand) and, on `trunk` only, runs `npx wrangler@4 deploy`. Static asset requests are free and unlimited.

### Why file count matters

The free plan allows 20,000 files per deployed version (100,000 on Paid) and 25 MiB per file. Every RFC is one `<n>/index.html`, so `dist/` is about 10.2k files today. To stay well under the limit, the build emits no per-RFC redirect stubs and no sharded search chunks; redirects live in a generated `_redirects` file and caching in a generated `_headers` file (both written by `scripts/pages/special.js`). RFCs grow by about 300 per year, so the headroom is decades. `scripts/check-dist.js` fails the build at 20,000 files, warns at 18,000, and checks `_redirects` against the 2,000 static / 100 dynamic rule caps.

### Redirects and caching

- `/rfc903` -> `/903/` comes from `_redirects` (`/rfc:num /:num/ 301`). This placeholder-in-segment form should be verified on a preview deploy (`npx wrangler@4 versions upload`); if it does not match, delete the rule. It is optional, since the old site never had `/rfcN` URLs.
- Legacy `/#rfcNNN` links are forwarded to `/NNN/` by the Atlas page's inline script.
- Slug aliases for explainers (`/<slug>` -> `/<n>/`) are also in `_redirects`.
- `_headers`: `/assets/*` is `public, max-age=31536000, immutable`; everything else (HTML, `data/`) is `public, max-age=300`; the static search index under `data/search/` is `max-age=60` since its file names are not hashed. Cloudflare handles edge caching for static assets itself.
- `www` -> apex is a Cloudflare dashboard setting (Redirect Rule), not part of this repo.

### One-time owner setup

1. Create the Worker `rfc-akl-run` (the first `npx wrangler@4 deploy` creates it) or reuse the existing one under the same name.
2. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` (token with the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`.
3. In the Cloudflare dashboard, Workers & Pages > `rfc-akl-run` > Settings > Domains & Routes: add the custom domain `rfc.akl.run` (and `www` if wanted, redirecting to the apex).
4. **Disable any existing Cloudflare Git-integration build** for this repo that runs the old `wrangler deploy --assets=./site`; `site/` no longer exists and it will fail or deploy stale content. (Alternative: set its build command to `npm ci && node scripts/build.js` and its deploy command to `npx wrangler deploy`. The recommended path is GitHub Actions only.)
5. The Worker name `rfc-akl-run` matches the one the old site deployed to, so `wrangler deploy` updates it in place and an existing `rfc.akl.run` custom domain keeps working; nothing to migrate.
6. Create the GitHub label `explainer-request` so `fetch-demand.js` has something to read.

RFC text is (c) IETF Trust; explanations are on rfc.akl.run.
