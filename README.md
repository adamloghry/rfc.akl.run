# rfc.akl.run

A statically generated explainer site for the Internet's RFCs. Every RFC number from 1 to the latest gets a permanent page at `rfc.akl.run/<n>/`; the ones that have been written up get plain-language summaries, diagrams and interactive packet and sequence viewers. Everything is pre-rendered HTML: no server code, no runtime services, no third-party requests.

The nightly build reads the RFC Editor index, merges it with the hand-written JSON in `content/`, and renders about 20,000 pages into `dist/` in a few seconds, plus a Pagefind search index.

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
- `--no-pagefind` skips the search index.

Other commands: `npm test`, `npm run lint` (content lint), `npm run check` (verifies `dist/`: links, anchors, that every sitemap URL resolves to a file, and size budgets).

With Nix: `nix develop` gives a shell with Node 22, Python 3 and the gcloud CLI; `nix run` runs `npm ci && npm run build && npm run serve` in the working tree.

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
  deploy-gcs.sh     Upload dist/ to GCS and purge Cloudflare
test/               node:test suites and fixtures
docs/design-handoff/  Design and build spec
.github/workflows/  ci.yml (PRs and trunk), nightly.yml (build + deploy)
```

## Deploy

Hosting is a GCS bucket behind Cloudflare. `.github/workflows/nightly.yml` builds daily at 06:17 UTC (and on demand) and, on `trunk` only, runs `scripts/deploy-gcs.sh`. The script uploads content-hashed files first, (`assets/`, `search/index/`, `search/fragment/`, and the content-hashed `search/pagefind.*.pf_meta`) first, then HTML with a short TTL, then prunes stale hashed files, then purges Cloudflare. Every `gcloud storage rsync` runs with `--checksums-only`: the build recreates `dist/`, so mtimes always change and the default comparison would re-upload everything. `bash scripts/deploy-gcs.sh --dry-run` prints the commands without running anything; `--init` sets the bucket's website config once. `--fix-headers` re-stamps Cache-Control on objects rsync skipped as unchanged: the first deploy into a non-empty bucket, or any change to the header policy, needs it (rsync only applies `--cache-control` to objects it uploads).

| Piece | Setting |
|---|---|
| Bucket name | `rfc.akl.run` (must equal the hostname; requires domain verification) |
| Website config | `MainPageSuffix=index.html`, `NotFoundPage=404.html` |
| Access | `allUsers: roles/storage.objectViewer` |
| DNS (Cloudflare) | `CNAME rfc.akl.run -> c.storage.googleapis.com`, proxied. Optional `www` CNAME plus redirect rule to the apex. |
| SSL/TLS mode | Flexible (GCS website endpoints are HTTP-only for custom domains) |
| Cloudflare | Always Use HTTPS, HSTS on, Brotli on |
| Cache rule | Cache Everything for `rfc.akl.run/*`, edge TTL respects origin |
| Cache-Control | HTML and `data/coverage.json`: `public, max-age=300, s-maxage=86400`. `assets/`, `search/index/`, `search/fragment/`, `search/pagefind.*.pf_meta`: `public, max-age=31536000, immutable` |

### One-time owner setup

Nothing here has been provisioned. The deploy fails until all of it is done.

1. Verify the `rfc.akl.run` domain for your Google account in Search Console (required to name a bucket after the domain).
2. Create the bucket `rfc.akl.run` (single region is fine behind a CDN) and grant `allUsers` the `roles/storage.objectViewer` role.
3. Create a deploy service account with `roles/storage.admin` on that bucket (or object admin plus bucket update for `--init`).
4. Set up Workload Identity Federation for `adamloghry/rfc.akl.run` and allow it to impersonate the service account.
5. In Cloudflare: add the proxied CNAME above, set SSL/TLS to Flexible, turn on Always Use HTTPS, HSTS and Brotli, and add a Cache Everything rule for `rfc.akl.run/*`. Optionally add redirect rules for `/rfc903` -> `/903/` and `www` -> apex.
6. Add GitHub repository secrets: `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`, `CF_ZONE_ID`, `CF_API_TOKEN` (token scoped to Cache Purge for the zone).
7. Run `BUCKET=rfc.akl.run bash scripts/deploy-gcs.sh --init` once from an authenticated shell, or run the Nightly workflow manually with the `init` input ticked, to set the website config.
8. Create the GitHub label `explainer-request` so `fetch-demand.js` has something to read.

RFC text is (c) IETF Trust; explanations are on rfc.akl.run.
