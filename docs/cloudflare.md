# Cloudflare deploy

rfc.akl.run is an assets-only Worker named `rfc-akl-run` (free plan) that serves `dist/`. Config: `wrangler.jsonc`.
Redirects, headers and the error page are generated into `dist/` by `src/integrations/build-files.ts`.

## Dashboard checklist

1. **Old Git-integration build**: Workers & Pages > `rfc-akl-run` > Settings > Builds. Disconnect it. It ran
   `wrangler deploy --assets=./site`, and `site/` no longer exists. (If you keep it, set build command
   `npm ci && npm run build` and deploy command `npx wrangler deploy`; GitHub Actions is the supported path.)
2. **GitHub secrets** (repo Settings > Secrets and variables > Actions):
   - `CLOUDFLARE_ACCOUNT_ID`: the account id (dashboard right sidebar).
   - `CLOUDFLARE_API_TOKEN`: create at My Profile > API Tokens > Create Token, template "Edit Cloudflare Workers".
     Minimum permissions if you build a custom token: Account > Workers Scripts > Edit, Account > Account Settings > Read,
     User > User Details > Read. Scope it to this one account. Add Zone > Workers Routes > Edit only if you un-comment `routes` in `wrangler.jsonc`.
3. **Custom domain**: Workers & Pages > `rfc-akl-run` > Settings > Domains & Routes > Add > Custom domain > `rfc.akl.run`.
   Already attached. Declaring it in `wrangler.jsonc` (`routes`, commented out there) is optional; if you do, deploys manage it.
4. **www -> apex**: Rules > Redirect Rules > Create: `http.host eq "www.rfc.akl.run"` -> Dynamic redirect to
   `concat("https://rfc.akl.run", http.request.uri.path)`, status 301, preserve query string. `www` needs a proxied DNS record (e.g. `AAAA www 100::`).
5. **Web Analytics (optional, cookieless)**: Analytics & Logs > Web Analytics > Add site (`rfc.akl.run`), copy the token, set it
   as the repository variable `PUBLIC_CF_BEACON_TOKEN`. When it is set at build time `BaseLayout.astro` adds the beacon script and
   the CSP in `_headers` gains `https://static.cloudflareinsights.com` (script-src) and `https://cloudflareinsights.com` (connect-src).
   When unset, nothing changes. The Nix build is hermetic and cannot read the environment, so the token is an overridable package
   attribute (`beaconToken`, default empty). With npm: `PUBLIC_CF_BEACON_TOKEN=... npm run build`. With Nix:

   ```
   nix build --impure --expr '(builtins.getFlake (toString ./.)).packages.${builtins.currentSystem}.site.override { beaconToken = "<token>"; }'
   # serve or deploy that build with the flake's apps:
   nix run --impure --expr 'let f = builtins.getFlake (toString ./.); s = builtins.currentSystem; in (f.lib.${s}.mkApps (f.packages.${s}.site.override { beaconToken = "<token>"; })).deploy'
   ```

   (`--impure` is only needed for `builtins.currentSystem`; write the system out, e.g. `x86_64-linux`, to drop it.) The workflows do not
   set a token: to enable analytics in the nightly deploy, change its Deploy step to the second command with
   `beaconToken = "${{ vars.PUBLIC_CF_BEACON_TOKEN }}"`.
6. **Preview URLs**: `wrangler.jsonc` sets `workers_dev: true` and `preview_urls: true`. `.github/workflows/preview.yml` runs
   `wrangler versions upload --preview-alias pr-<number>` on every PR (same-repo PRs only; forks have no secrets and skip) and comments the
   URL, `https://pr-<number>-rfc-akl-run.<account-subdomain>.workers.dev`. A version upload is not a deployment: production is unchanged. Previews
   need the account's `workers.dev` subdomain to exist (Workers & Pages > Overview > Subdomain). Preview URLs are public unless you protect them with Cloudflare Access.
   **`workers_dev: true` also exposes production** at `https://rfc-akl-run.<account-subdomain>.workers.dev`, which serves the same content as
   `rfc.akl.run`. Every page carries `<link rel="canonical" href="https://rfc.akl.run/...">` (checked in `e2e/cloudflare.spec.ts`), so search
   engines index the apex domain. Turning `workers_dev` off would also disable the preview URLs, so it stays on.
7. **Nightly index refresh and branch protection**: `nightly.yml` refreshes `data/rfc-index.xml` and, when it changed, commits
   `chore(data): refresh RFC Editor index` to `trunk` as `github-actions[bot]` (the workflow has `contents: write`) before building and
   deploying from that commit. If `trunk` is protected (required reviews or status checks), that push is rejected and the job **fails** at
   the "Commit refreshed snapshot" step with an error annotation; nothing is deployed. Fix it by letting `github-actions[bot]` bypass the rule
   (Settings > Rules > the trunk ruleset > Bypass list), or by switching the step to open a pull request instead. Settings > Actions > General >
   Workflow permissions must allow the token to write (or keep the workflow-level `permissions` block, which requests it).

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
- **HSTS later**: `includeSubDomains` is deliberately off. With it, browsers refuse plain HTTP for every subdomain of `rfc.akl.run` for a year, which
  breaks any subdomain that is not HTTPS-only yet. To add it, first confirm every subdomain (and `www`) serves valid HTTPS, then change the
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
| `/rfc903` | 301, `Location: /903/` (the `/rfc:num /:num/ 301` placeholder-in-segment rule works), then 200 |
| `/404` | 301, `Location: /404/`; `/404/` is the RFC 404 page (200), not the error page |
| `/903` | **307** `Location: /903/` (auto-trailing-slash answers 307, not 301), then 200 |
| `/definitely/not/here`, `/nope`, `/903/missing/`, `/data/nothing.json` | **404** with the body of `404.html` ("No page here"), `text/html` |
| `/not-found/` | 404 (the error page lives only at `/404.html`) |
| `/assets/*` (css, woff2) | `Cache-Control: public, max-age=31536000, immutable` (single value, no duplicate from `/*`) |
| `/`, `/903/`, `/data/coverage.json`, `/data/titles/*` | `Cache-Control: public, max-age=300` |
| `/data/search/*` | `Cache-Control: public, max-age=60` |
| every response | nosniff, referrer-policy, permissions-policy, `X-Frame-Options: DENY`, HSTS, CSP |

Notes: wrangler warns that static rules should come before placeholder rules, so the generated `_redirects` lists `/404` and slug aliases first and `/rfc:num` last.
The local runtime is workerd, the same engine as production, but the final confirmation of production-only behaviour (HSTS on the real domain, `workers.dev` preview URLs) is a preview-URL smoke test: `E2E_BASE_URL=<preview url> npm run test:e2e`.
Slug-alias redirects (`/<slug> -> /<n>/`) are exercised only when the build has aliases (the offline build has none, so that test skips).
