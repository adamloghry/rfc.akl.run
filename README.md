# rfc.akl.run

A statically generated showcase of the Internet's RFCs. Every RFC number from 1 to the latest gets a permanent page at `rfc.akl.run/rfc<n>` (for example `https://rfc.akl.run/rfc903`; no zero-padding). The point of the site is the **original RFC text** (committed at `data/rfc-text/<n>.txt`, typeset on the page with page-break noise removed, linked RFC and Section references and a contents rail). Every issued RFC also has an **ISO Plain Language** tab: an AI-generated explainer written to ISO 24495-1 plain language and not deeply reviewed with diagrams and interactive packet and sequence viewers, clearly labelled as a bonus. Everything is pre-rendered HTML: no server code, no runtime services, no third-party requests.

The build reads the committed RFC Editor index snapshot (`data/rfc-index.xml`), merges it with the hand-written JSON in `content/`, and renders about 10,000 RFC pages (plus a static search index) into `dist/` in about a minute with Astro 7. Each RFC page carries its full text (`dist/` is about 430 MB; the largest page, RFC 9980, is 533 KB gzipped).

## Page tiers

Every RFC page has two tabs, **RFC text** (default) and **ISO Plain Language** (`#plain-language`; any anchor inside it, such as `#packet-format`, opens it; both panels render in order without JS). Under the datasheet band, the AI tab states its tier: **Index** (title, authors, status, abstract, lineage; generated from the RFC Editor index), **Summary** (plain-language summary and a shorter plain-language version from a small JSON file in `content/rfcs/`), **Explainer** (sections, glossary terms, diagrams) and **Interactive** (packet inspector or sequence simulator from the viz library).

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
| `npm run check` | Verifies `dist/`: links, anchors, that every sitemap URL resolves to a file, size budgets (an RFC page: 60 KB gz plus 1.25 x the gzip size of its RFC text; JS counted with its statically imported chunks), forbidden strings in built HTML (the RFC Editor text itself is excluded from the link, anchor and string checks; the repo slug `adamloghry/rfc.akl.run` and the solicitation copy "Contribute", "Request an explainer", feed.xml anywhere; GitHub only outside `<main>`, since RFC content may mention it), that `404.html`, `rfc404.html`, `_redirects` and `_headers` exist (and no `not-found/` dir), that internal links resolve to files the way Cloudflare serves them (`/rfc903` to `rfc903.html`, `/areas/core` to `areas/core.html`, `/` to `index.html`) and that no internal link has a trailing slash or is an old-style `/<n>/` link, the Cloudflare file-count limit and `_redirects` rule limits |
| `npm run check:types` | `astro check` (TypeScript and Astro diagnostics) |
| `npm run parity` | Dev tool: structural comparison of `dist/` pages against a golden directory (see below) |
| `npm run test:e2e` | Playwright (desktop and 390px mobile) against `wrangler pages dev` serving `dist/` (build first) |
| `npm run lint:code` | Biome check (lint and format) |
| `npm run refresh-index` | Fetch the RFC Editor index into `data/rfc-index.xml` (see below) |
| `npm run deploy` | Build, check, then `wrangler pages deploy --branch trunk` (uses `$WRANGLER_BIN` when set, as in `nix develop`); `deploy:preview` deploys to the `preview` branch instead |

The scripts run TypeScript through `node --import tsx`, which works everywhere (the `tsx` CLI itself can fail in sandboxes that block its IPC socket).

### Test layers

1. **Unit and coverage** (`npm test`, `npm run test:coverage`): pure `src/lib` logic, CLI scripts, and the browser scripts in `src/scripts` driven through happy-dom against markup fixtures extracted from the real build (`scripts/extract-client-fixtures.ts`). Coverage thresholds (per-glob, in `vitest.config.ts`) fail the run when they drop.
2. **Component tests**: the same Vitest run renders Astro components through the Container API and checks the HTML.
3. **End to end** (`npm run test:e2e`): Playwright drives Chromium against `wrangler pages dev` (Cloudflare Pages' workerd runtime) serving the built `dist/`, so redirects, `_headers`, the CSP (any violation fails a test), the custom 404 and the mobile layout are tested as Cloudflare will serve them. Needs `wrangler` and a Playwright Chromium (`npx playwright install chromium`, or `nix develop`). `WRANGLER_BIN` and `E2E_BASE_URL` override the server.
4. **`nix flake check -L`**: runs all of the above plus types, Biome, the site build with `npm run preflight`, and formatting, in the Nix sandbox. Run it before pushing to `trunk`.

### Nix (optional, recommended)

The flake builds, checks and deploys the site with no network access during the build. The RFC Editor index is a committed snapshot, `data/rfc-index.xml` (see "The RFC index snapshot" below), so a given commit always produces the same site. The npm path above keeps working for anyone without Nix.

```sh
nix develop                  # Node 22, nixpkgs wrangler, biome, Playwright browsers, nixfmt
nix build                    # packages.default: the built site (dist/ contents) in ./result
nix flake check -L           # unit, lint, types, code-style, site (build + preflight), e2e, formatting
nix run                      # serve the Nix-built site with `wrangler pages dev` on :8787 (PORT=... to change)
nix run .#deploy             # wrangler pages deploy --branch trunk of the Nix-built site (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
nix run .#preview-deploy     # wrangler pages deploy --branch preview (a preview deployment, not production)
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

Refresh it with `npm run refresh-index` or `nix run .#refresh-index`. The script fetches the live index, checks that it parses and has at least as many entries as the snapshot, writes the file, and prints `changed` or `unchanged`. Commit the result and push; with Git integration the push to `trunk` redeploys. Nothing refreshes it automatically.

### Parity tool

`scripts/parity.ts` compares built pages with the output of the pre-Astro generator and prints a similarity score per page. It is only useful while checking a migration or large template change. Produce a golden directory by building the reference revision (the commit before the Astro port, `9f95045`, with `node scripts/build.js --out .work/golden`), then:

```sh
node --import tsx scripts/parity.ts [paths...] [--golden .work/golden] [--dist dist] [--full]
```

The golden directory defaults to `.work/golden` (git-ignored).

## Content

Content lives in `content/` as JSON and is loaded through Astro content collections (`src/content.config.ts`: `rfcs`, `journeys`, `glossary`). Every file is validated at build time with the Zod schemas in `src/lib/schemas.ts`, which are the source of truth for the shape (the same schemas power `npm run lint`). A bad file fails the build with the collection, id and field path.

- RFC files: `content/rfcs/<n>.json` (plain number, e.g. `content/rfcs/903.json`; no zero-padding). Start from an existing file of similar level.
- Journeys: `content/journeys/<slug>.json`. Glossary terms: `content/glossary/<term-id>.json`.
- Optional signal: `content/signals/traffic.json` (per-RFC traffic counts that feed the priority score).
- **Permalink lock:** section ids become URL anchors (`/rfc903#how-it-works`). `content/section-ids.lock.json` records every published id, and lint fails if one disappears. After adding sections, run `node --import tsx scripts/lint-content.ts --update-lock` and commit the lock. Never rename a published id.
- **Sanitizer:** every HTML field (`summary`, `today`, `plainLanguage`, section `content`/`plainLanguage`, glossary `definition`) is checked against an allowlist of tags and attributes (`src/lib/sanitize-check.ts`). Both lint and the build run the check and fail on violations.
- **Provenance policy:** LLM-drafted content is always labeled. A machine-drafted file carries `provenance.source = "llm-draft"` and `provenance.reviewedBy = null`, and its page shows "Draft · machine-assisted, not yet reviewed". A human must review the content against the RFC text before `reviewedBy` is set. Nothing is generated at request time.

## Project structure

```
content/              Hand-written JSON: rfcs/, journeys/, glossary/, signals/, section-ids.lock.json
src/
  content.config.ts   Content collections (glob loaders + Zod schemas)
  pages/              Routes: rfc[n].astro (every RFC, built to rfc<n>.html), index (Atlas), areas/, journeys/, glossary/, graph/,
                      404.astro (built to dist/404.html), data/ and sitemap/robots endpoints
  components/         Astro components: chrome/, rfc/, atlas/, viz/ (packet and sequence viewers, diagrams)
  layouts/            BaseLayout.astro
  lib/                Site model, RFC index loader, schemas, sanitizer, search index, data-file builders
  integrations/       build-files.ts: writes _redirects, _headers and 404.html after the build
  scripts/            Browser scripts (theme, search, atlas, graph, packet, sim, reader)
  styles/             CSS
scripts/              CLI tools run with node --import tsx: lint-content, check-dist, parity,
                      coverage-diff, import-summaries, merge-glossary, make-summary-batches
test/                 Vitest suites and fixtures
e2e/                  Playwright specs (run against wrangler pages dev)
docs/                 Design and build specs
flake.nix, nix/        Nix package, checks, apps and dev shell
```

## Deploy

Hosting is a Cloudflare Pages project, `rfc-akl-run` (free plan, static only), configured by `wrangler.jsonc` (`pages_build_output_dir: ./dist`). Production is `https://rfc.akl.run`; `rfcs.akl.run` redirects to it. Setup, domains and limits are in [docs/cloudflare.md](docs/cloudflare.md). In short: connect the GitHub repo in the Pages dashboard with build command `npm run build && npm run check`, output directory `dist` and production branch `trunk`, and every push to `trunk` deploys (other branches get preview deployments). Without Git integration, `npm run deploy` (or `nix run .#deploy`) builds, checks and runs `wrangler pages deploy --branch trunk`. Static requests are free and unlimited.

### Why file count matters

The free plan allows 20,000 files per deployment and 25 MiB per file. Every RFC is one `rfc<n>.html`, so `dist/` is about 10.2k files today. To stay well under the limit, the build emits no per-RFC redirect stubs and no sharded search chunks; redirects live in a generated `_redirects` file and caching in a generated `_headers` file (both written by `src/integrations/build-files.ts`). RFCs grow by about 300 per year, so the headroom is decades. `scripts/check-dist.ts` fails the build at 20,000 files, warns at 18,000, and checks `_redirects` against the 2,000 static / 100 dynamic rule caps.

### Redirects and caching

- **URL scheme:** the site has no trailing slashes anywhere. RFC pages are `/rfc903` (file `rfc903.html`, built with `build.format: 'file'` and `trailingSlash: 'never'`), sections are `/rfc903#packet-format`, other pages are `/areas/core`, `/glossary/m`, `/journeys/request`, `/graph`; only the root is `/`. Numbers are never zero-padded. Not-issued and reserved numbers also live at `/rfc<n>` (so `/rfc404` is the RFC 404 page, and the error page is the ordinary `404.html`).
- Cloudflare Pages serves `foo.html` at `/foo` with a 200 and redirects `/foo/` and `/foo.html` to `/foo` (308). No `_redirects` rule is needed for this; e2e checks it. The old `/<n>/` URLs were never deployed, so there are no redirects for them.
- Legacy `/#rfcNNN` links are forwarded to `/rfcNNN` by the Atlas page's inline script.
- Slug aliases for explainers (`/<slug>` -> `/rfc<n>`) are the only `_redirects` rules.
- `_headers`: `/assets/*` is `public, max-age=31536000, immutable`; everything else (HTML, `data/`) is `public, max-age=300`; the static search index under `data/search/` is `max-age=60` since its file names are not hashed. Cloudflare handles edge caching for static assets itself.
- The `rfcs.akl.run` -> `rfc.akl.run` redirect is a Cloudflare dashboard setting (Redirect Rule), not part of this repo.

### One-time owner setup

1. Create the Pages project `rfc-akl-run`, either Git-integrated (recommended) or Direct Upload; Cloudflare cannot switch a Direct Upload project to Git later. Settings are in [docs/cloudflare.md](docs/cloudflare.md).
2. Workers & Pages > `rfc-akl-run` > Custom domains: add `rfc.akl.run`.
3. Redirect `rfcs.akl.run` to `https://rfc.akl.run` with a Redirect Rule in the `akl.run` zone (details in docs/cloudflare.md).

RFC text is (c) IETF Trust; explanations are on rfc.akl.run.
