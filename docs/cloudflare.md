# Cloudflare deploy

rfc.akl.run is an assets-only Worker named `rfc-akl-run` (free plan, no Worker script) that serves `dist/`. Config: `wrangler.jsonc`
(`assets.directory: ./dist`, `html_handling: auto-trailing-slash`, `not_found_handling: 404-page`). Redirects, headers and the error page
are generated into `dist/` by `src/integrations/build-files.ts`. The canonical host is `https://rfc.akl.run`; `rfcs.akl.run` is an alias
that redirects to it.

## Workers Builds (Git integration)

Workers & Pages > Create > Import a repository > `adamloghry/rfc.akl.run`, then (or later under `rfc-akl-run` > Settings > Build):

| Setting | Value |
|---|---|
| Project name | `rfc-akl-run` (must match `name` in `wrangler.jsonc`) |
| Production branch | `trunk` |
| Build command | `npm run build && npm run check` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | `/` (default) |

Node comes from `.node-version` (22.23.3); npm installs from `package-lock.json`. The build reads only committed files (no network) and takes
about a minute. `npm run check` fails the build on a broken link, a missing anchor or a Cloudflare limit, so nothing broken is deployed.
Pushes to `trunk` deploy production. Other branches upload a version without deploying it, and Cloudflare reports its preview URL
(`https://<branch>-rfc-akl-run.<account-subdomain>.workers.dev`) on the commit. Turn that off under Settings > Build > Branch control if you do not want it.

Do not change the deploy command to `wrangler pages deploy`: this is a Worker, not a Pages project.

### Manual deploy (from this machine)

```
npx wrangler login                 # or CLOUDFLARE_API_TOKEN ("Edit Cloudflare Workers" template) + CLOUDFLARE_ACCOUNT_ID
npm run deploy                     # build, check, wrangler deploy (production)
npm run deploy:preview             # build, check, wrangler versions upload (preview URL, production unchanged)
```

With Nix: `nix run .#deploy` and `nix run .#preview-deploy` deploy the Nix-built site the same way (extra arguments pass through to wrangler).

## Domains

1. **rfc.akl.run**: Workers & Pages > `rfc-akl-run` > Settings > Domains & Routes > Add > Custom domain > `rfc.akl.run`. With the `akl.run`
   zone in the same account, Cloudflare creates the DNS record and certificate. (Or un-comment `routes` in `wrangler.jsonc` so each deploy
   manages it.)
2. **rfcs.akl.run (alias)**: redirect it rather than serving a second copy. In the `akl.run` zone add a proxied DNS record
   `AAAA rfcs 100::`, then Rules > Redirect Rules > Create: `http.host eq "rfcs.akl.run"` -> Dynamic,
   `concat("https://rfc.akl.run", http.request.uri.path)`, status 301, preserve query string. (Adding `rfcs.akl.run` as a second
   custom domain also works; every page's `<link rel="canonical">` still names `https://rfc.akl.run`, but the redirect keeps one URL per page.)
3. **workers.dev**: `workers_dev: true` also serves production at `https://rfc-akl-run.<account-subdomain>.workers.dev`. Canonical links
   point search engines at `rfc.akl.run` (checked in `e2e/cloudflare.spec.ts`). Turning `workers_dev` off would also turn off preview URLs,
   so it stays on.

## Web Analytics (optional, cookieless)

Do **not** use the Worker's one-click Web Analytics toggle: it injects a beacon script at the edge that the CSP in `_headers`
blocks. Instead, Analytics & Logs > Web Analytics > Add site (`rfc.akl.run`, manual setup), copy the token and set it at build time:
with Workers Builds as the build variable `PUBLIC_CF_BEACON_TOKEN` (Settings > Build > Variables and secrets), locally as
`PUBLIC_CF_BEACON_TOKEN=... npm run build`. When it is set, `BaseLayout.astro` adds the beacon script and the CSP gains
`https://static.cloudflareinsights.com` (script-src) and `https://cloudflareinsights.com` (connect-src). When unset, nothing changes.
The Nix build is hermetic and cannot read the environment, so the token is an overridable package attribute (`beaconToken`, default empty):

```
nix build --impure --expr '(builtins.getFlake (toString ./.)).packages.${builtins.currentSystem}.site.override { beaconToken = "<token>"; }'
# serve or deploy that build with the flake's apps:
nix run --impure --expr 'let f = builtins.getFlake (toString ./.); s = builtins.currentSystem; in (f.lib.${s}.mkApps (f.packages.${s}.site.override { beaconToken = "<token>"; })).deploy'
```

(`--impure` is only needed for `builtins.currentSystem`; write the system out, e.g. `x86_64-linux`, to drop it.)

## RFC index refresh

Nothing refreshes `data/rfc-index.xml` automatically. Run `npm run refresh-index` (or `nix run .#refresh-index`), commit the result
and push; the push to `trunk` redeploys.

## Limits (Workers static assets, free plan)

| Limit | Value | Where we check |
|---|---|---|
| Files per version | 20,000 (100,000 paid) | `check-dist`: error at 20,000, warn at 18,000 (dist is ~10.2k) |
| Size per file | 25 MiB | `check-dist` |
| `_redirects` | 2,000 static + 100 dynamic rules, 1,000 chars per rule | `check-dist` (counts) and rule syntax |
| `_headers` | 100 rules, 2,000 chars per line | `check-dist` (we use 3 rules) |
| Static asset requests | free and unlimited | |
| Worker versions with preview URLs | free | |

`npm run preflight` also checks that `wrangler.jsonc` `assets.directory` is the directory being checked and that every inline script is covered by the CSP hash list in `_headers`.

## Headers and CSP

`_headers` applies to `/*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a deny-all
`Permissions-Policy`, `X-Frame-Options: DENY`, HSTS (`max-age=31536000`, 1 year, no `includeSubDomains`) and the CSP:

`default-src 'self'; script-src 'self' <sha256 of every inline script>; style-src 'self' <sha256 of inline <style>>; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

- Hashes are computed from the built HTML (`collectInlineHashes` in the integration), so they cannot drift: the pre-paint theme script, the
  Atlas `#rfcN` forwarder, and the 404 page script (3 hashes today). `npm run preflight` and the e2e suite check both inline scripts and inline `<style>` elements against the `script-src` / `style-src` hash lists.
- Astro's built-in `security.csp` emits per-page `<meta>` tags (headers only via adapters with `staticHeaders`, which assets-only Workers do not use), so the integration approach is used.
- `style-src-attr 'unsafe-inline'` is needed because the markup uses `style="--cols:32"` attributes for layout. It does not allow `<style>` elements or any script.
- **HSTS later**: `includeSubDomains` is deliberately off. Sent from `rfc.akl.run` it would cover only `*.rfc.akl.run` (not `akl.run` or
  its other subdomains), so it is low-risk, but there is no need for it yet. To add it, change the
  header in `src/lib/data-files.ts` (`headersFile`) and the expectations in `test/headers.test.ts` and `e2e/cloudflare.spec.ts` to
  `max-age=31536000; includeSubDomains`. `preload` additionally requires `max-age>=31536000` plus `includeSubDomains`, and submission to hstspreload.org;
  removal from the preload list takes months, so do that last and only when you are sure.
- Cloudflare **joins** a header set by several matching rules with `, `. `/assets/*` and `/data/search/*` therefore use `! Cache-Control` to detach the default `public, max-age=300` before setting their own (verified below).

## Running the e2e tests

The suite (`e2e/*.spec.ts`, chromium only; a `desktop` project and a 390px `mobile` project) runs against `wrangler dev --local`
(workerd) serving `dist/`, so redirects, headers and 404 handling are Cloudflare's, not a mock. Every test also fails on any CSP
violation (`securitypolicyviolation` event or Chromium CSP console message) or uncaught page error.

Without Nix:

```
npm ci
npx playwright install chromium
npm run build:offline        # dist/ is required; the config refuses to start without it
npm run test:e2e
```

With Nix (the dev shell provides the matching nixpkgs wrangler and Playwright browsers and sets `WRANGLER_BIN`, `PLAYWRIGHT_BROWSERS_PATH`
and friends; npm's own wrangler/workerd does not run on NixOS):

```
nix develop -c npm ci
nix develop -c npm run build:offline
nix develop -c npm run test:e2e
```

`nix flake check -L` runs the same suite in the Nix sandbox against the Nix-built site.

Env: `WRANGLER_BIN` (default `wrangler` from PATH), `E2E_BASE_URL` (test an already-running server or a preview URL; skips the webServer; the `dist/`-reading assertions
in `cloudflare.spec.ts` still read the local `dist/`). Compatibility date: wrangler 4.93's bundled workerd supports dates up to 2026-05-25, so `wrangler.jsonc` pins `2026-05-01`.

## Observed Cloudflare behaviour (wrangler 4.93.0 / workerd 1.20260518.1, `html_handling: auto-trailing-slash`, `not_found_handling: 404-page`)

| Request | Result |
|---|---|
| `/rfc903` | **200**, served from `rfc903.html`, no redirect |
| `/rfc903/` | **307** `Location: /rfc903` (auto-trailing-slash), then 200; same for `/areas/` -> `/areas`, `/glossary/m/` -> `/glossary/m` etc. |
| `/rfc404` | 200, the RFC 404 page (not the error page) |
| `/903`, `/903/` (old scheme, never deployed) | **404** |
| `/definitely/not/here`, `/nope`, `/rfc903/missing`, `/rfc99999`, `/data/nothing.json` | **404** with the body of `404.html` ("No page here"), `text/html` |
| `/not-found` | 404 (the error page lives only at `/404.html`) |
| `/assets/*` (css, woff2) | `Cache-Control: public, max-age=31536000, immutable` (single value, no duplicate from `/*`) |
| `/`, `/rfc903`, `/data/coverage.json`, `/data/titles/*` | `Cache-Control: public, max-age=300` |
| `/data/search/*` | `Cache-Control: public, max-age=60` |
| every response | nosniff, referrer-policy, permissions-policy, `X-Frame-Options: DENY`, HSTS, CSP |

Notes: URL scheme is slash-less (`build.format: 'file'`, `trailingSlash: 'never'`): every page is `<path>.html`, so `html_handling: "auto-trailing-slash"` serves `/rfc903` from `rfc903.html` and redirects `/rfc903/` to `/rfc903` (per Cloudflare's HTML handling table: `/file` 200, `/file/` 307 to `/file`). `_redirects` therefore holds only explainer slug aliases (`/<slug> /rfc<n> 301`) and is empty of rules in the offline build.
The local runtime is workerd, the same engine as production, but the final confirmation of production-only behaviour (HSTS on the real domain, `workers.dev` preview URLs) is a preview-URL smoke test: `E2E_BASE_URL=<preview url> npm run test:e2e`.
Slug-alias redirects (`/<slug> -> /rfc<n>`) are exercised only when the build has aliases (the offline build has none, so that test skips).
