# rfc.akl.run

A statically generated explainer site for the Internet's RFCs. Every RFC number from 1 to the latest gets a permanent page at `rfc.akl.run/<n>/`; the ones that have been written up get plain-language summaries, diagrams and interactive packet and sequence viewers. Everything is pre-rendered HTML: no server code, no runtime services, no third-party requests.

The nightly build refreshes the committed RFC Editor index snapshot (`data/rfc-index.xml`), merges it with the hand-written JSON in `content/`, and renders about 10,000 RFC pages (plus a static search index) into `dist/` in under a minute with Astro 7.

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
npm run build          # reads the committed data/rfc-index.xml (never the network), writes dist/
npm run build:offline  # same as build; kept as an alias
npm run refresh-index  # the only networked step: re-fetches data/rfc-index.xml from rfc-editor.org
npm run preview        # serves dist/ locally
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Vitest: unit tests, happy-dom client-script tests and Astro component tests (Container API) |
| `npm run test:coverage` | `npm test` with v8 coverage over `src/lib/**` and `src/scripts/**`; fails below the thresholds in `vitest.config.ts` |
| `npm run lint` | Content lint (Zod schemas, cross-references, viz rendering and anchors, permalink lock, HTML sanitizer). `--only <file>` lints specific files |
| `npm run check` | Verifies `dist/`: links, anchors, that every sitemap URL resolves to a file, size budgets (JS counted with its statically imported chunks), that `404.html`, `404/index.html`, `_redirects` and `_headers` exist (and no `not-found/` dir), the Cloudflare file-count limit and `_redirects` rule limits |
| `npm run check:types` | `astro check` (TypeScript and Astro diagnostics) |
| `npm run parity` | Dev tool: structural comparison of `dist/` pages against a golden directory (see below) |
| `npm run test:e2e` | Playwright (desktop and 390px mobile) against `wrangler dev --local` serving `dist/` (build first) |
| `npm run lint:code` | Biome check (lint and format) |
| `npm run refresh-index` | Fetch the RFC Editor index into `data/rfc-index.xml` (see below) |
| `npm run deploy` | Build, check, then `wrangler deploy` (uses `$WRANGLER_BIN` when set, as in `nix develop`) |

The scripts run TypeScript through `node --import tsx`, which works everywhere (the `tsx` CLI itself can fail in sandboxes that block its IPC socket).

### Test layers

1. **Unit and coverage** (`npm test`, `npm run test:coverage`): pure `src/lib` logic, CLI scripts, and the browser scripts in `src/scripts` driven through happy-dom against markup fixtures extracted from the real build (`scripts/extract-client-fixtures.ts`). Coverage thresholds (per-glob, in `vitest.config.ts`) fail the run when they drop.
2. **Component tests**: the same Vitest run renders Astro components through the Container API and checks the HTML.
3. **End to end** (`npm run test:e2e`): Playwright drives Chromium against `wrangler dev --local` (Cloudflare's workerd runtime) serving the built `dist/`, so redirects, `_headers`, the CSP (any violation fails a test), the custom 404 and the mobile layout are tested as Cloudflare will serve them. Needs `wrangler` and a Playwright Chromium (`npx playwright install chromium`, or `nix develop`). `WRANGLER_BIN` and `E2E_BASE_URL` override the server.
4. **`nix flake check -L`**: runs all of the above plus types, Biome, the site build with `npm run preflight`, and formatting, in the Nix sandbox. This is what CI runs.

### Nix (optional, recommended)

The flake builds, checks and deploys the site with no network access during the build. The RFC Editor index is a committed snapshot, `data/rfc-index.xml` (see "The RFC index snapshot" below), so a given commit always produces the same site. The npm path above keeps working for anyone without Nix.

```sh
nix develop                  # Node 22, nixpkgs wrangler, biome, Playwright browsers, nixfmt
nix build                    # packages.default: the built site (dist/ contents) in ./result
nix flake check -L           # unit, lint, types, code-style, site (build + preflight), e2e, formatting
nix run                      # serve the Nix-built site with `wrangler dev` on :8787 (PORT=... to change)
nix run .#deploy             # wrangler deploy of the Nix-built site (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
nix run .#preview-deploy     # wrangler versions upload (preview version, not promoted)
nix run .#refresh-index      # refresh data/rfc-index.xml (needs node_modules: npm ci)
nix fmt                      # nixfmt on flake.nix and nix/*.nix
```

- **After changing `package-lock.json`:** the npm dependency cache is a fixed-output derivation. Set `npmDepsHash` in `nix/common.nix` to a fake hash, run `nix build`, and paste the `got:` hash.
- **Flakes only see git-tracked files.** `git add` (or `git add -N`) new files before `nix build`.
- **Why wrangler comes from nixpkgs:** the `workerd` binary that npm installs is not patched for NixOS, and `npm run` prepends `node_modules/.bin` to `PATH`, which would shadow the nixpkgs wrangler even inside `nix develop`. So the dev shell sets `WRANGLER_BIN` to the nixpkgs wrangler, and `npm run preview:cf`, `deploy`, `deploy:preview` and the Playwright web server run `${WRANGLER_BIN:-wrangler}`.
- **Pinned tool versions:** `nix/common.nix` asserts that nixpkgs' wrangler, playwright-driver and biome match the versions in `package-lock.json`, and fails evaluation with a message if they drift.
- **Web Analytics token:** `PUBLIC_CF_BEACON_TOKEN` is baked in with `nix build --impure --expr '(builtins.getFlake (toString ./.)).packages.${builtins.currentSystem}.site.override { beaconToken = "..."; }'` (see `docs/cloudflare.md`).
- **Build date:** `SOURCE_DATE_EPOCH` is the flake's `lastModified` (commit time); evaluation fails for sources without one instead of building a 1970 date.
- **Formatter:** `nix fmt` runs nixfmt on `flake.nix` and `nix/*.nix`; arguments pass through (`nix fmt -- --check`), and the files are appended unless you name an existing path.
- Layout: `nix/common.nix` (source filter, build env, npm hash), `nix/package.nix` (the site), `nix/checks.nix`, `nix/apps.nix`, `nix/shell.nix`.

### The RFC index snapshot

`data/rfc-index.xml` is a committed copy of https://www.rfc-editor.org/rfc-index.xml (about 14 MB of XML; git delta-compresses the daily changes well). Builds, tests, lint and the Nix checks read only this file, so they never touch the network and a commit always builds the same site. `RFC_INDEX_FILE=<path>` overrides it (tests use this).

Refresh it with `npm run refresh-index` or `nix run .#refresh-index`. The script fetches the live index, checks that it parses and has at least as many entries as the snapshot, writes the file, and prints `changed` or `unchanged`. Commit the result. The nightly workflow does exactly this and commits `chore(data): refresh RFC Editor index` to trunk as `github-actions[bot]` before it builds and deploys (it needs permission to push to trunk; see `docs/cloudflare.md`).

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
e2e/                  Playwright specs (run against wrangler dev)
docs/                 Design and build specs
flake.nix, nix/        Nix package, checks, apps and dev shell
.github/workflows/    ci.yml (PRs and trunk), preview.yml (PR previews), nightly.yml (build + deploy)
```

## Deploy

Hosting is Cloudflare Workers static assets (free plan; details in [docs/cloudflare.md](docs/cloudflare.md)), configured by `wrangler.jsonc` (assets-only Worker `rfc-akl-run` serving `dist/`, custom 404 page, `auto-trailing-slash`). `.github/workflows/nightly.yml` builds daily at 06:17 UTC (and on demand) and, on `trunk` only, runs `nix run .#deploy` (nixpkgs wrangler). Static asset requests are free and unlimited.

### CI

- `ci.yml` (pull requests and pushes to `trunk`): installs Nix, restores a store cache, runs `nix flake check -L`. That builds the site against the locked RFC index and runs every check, including e2e.
- `preview.yml` (pull requests): `nix run .#preview-deploy -- --preview-alias pr-<n>` uploads a Worker version (not a deployment) and comments its URL on the PR. Skipped when the Cloudflare secrets are absent (fork PRs). Only this job has `pull-requests: write`.
- `nightly.yml`: `nix develop -c npm ci`, `nix run .#refresh-index`, commits `data/rfc-index.xml` to trunk as `github-actions[bot]` when it changed (trunk only; the push must be allowed, see `docs/cloudflare.md`), fetches reader demand, builds and prints the coverage diff against the live site, runs `nix flake check -L`, then on `trunk` runs `nix run .#deploy` from that commit.

### Why file count matters

The free plan allows 20,000 files per deployed version (100,000 on Paid) and 25 MiB per file. Every RFC is one `<n>/index.html`, so `dist/` is about 10.2k files today. To stay well under the limit, the build emits no per-RFC redirect stubs and no sharded search chunks; redirects live in a generated `_redirects` file and caching in a generated `_headers` file (both written by `src/integrations/build-files.ts`). RFCs grow by about 300 per year, so the headroom is decades. `scripts/check-dist.ts` fails the build at 20,000 files, warns at 18,000, and checks `_redirects` against the 2,000 static / 100 dynamic rule caps.

### Redirects and caching

- `/rfc903` -> `/903/` comes from `_redirects` (`/rfc:num /:num/ 301`). Verified against Cloudflare's local runtime (301); `/404` -> `/404/` (301) is listed before it. `/903` -> `/903/` is Cloudflare's own `auto-trailing-slash` (307). See [docs/cloudflare.md](docs/cloudflare.md) for the observed behaviour, header rules and CSP.
- Legacy `/#rfcNNN` links are forwarded to `/NNN/` by the Atlas page's inline script.
- Slug aliases for explainers (`/<slug>` -> `/<n>/`) are also in `_redirects`.
- `_headers`: `/assets/*` is `public, max-age=31536000, immutable`; everything else (HTML, `data/`) is `public, max-age=300`; the static search index under `data/search/` is `max-age=60` since its file names are not hashed. Cloudflare handles edge caching for static assets itself.
- `www` -> apex is a Cloudflare dashboard setting (Redirect Rule), not part of this repo.

### One-time owner setup

1. Create the Worker `rfc-akl-run` (the first `nix run .#deploy` creates it) or reuse the existing one under the same name.
2. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` (token with the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`.
3. In the Cloudflare dashboard, Workers & Pages > `rfc-akl-run` > Settings > Domains & Routes: add the custom domain `rfc.akl.run` (and `www` if wanted, redirecting to the apex).
4. **Disable any existing Cloudflare Git-integration build** for this repo that runs the old `wrangler deploy --assets=./site`; `site/` no longer exists and it will fail or deploy stale content. (Alternative: set its build command to `npm ci && npx astro build` and its deploy command to `npx wrangler deploy`. The recommended path is GitHub Actions only.)
5. The Worker name `rfc-akl-run` matches the one the old site deployed to, so `wrangler deploy` updates it in place and an existing `rfc.akl.run` custom domain keeps working; nothing to migrate.
6. Create the GitHub label `explainer-request` so `scripts/fetch-demand.ts` has something to read.

RFC text is (c) IETF Trust; explanations are on rfc.akl.run.
