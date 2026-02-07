# rfc.akl.run

An interactive viewer for the Internet's most important RFCs.

## Deployment

Pushes to `trunk` are automatically built and deployed to [rfc.akl.run](https://rfc.akl.run) via Cloudflare Pages.

**Cloudflare Pages build settings:**

| Field | Value |
|---|---|
| Build command | `node scripts/build.js` |
| Deploy command | `npx wrangler deploy --assets=./site` |
| Root directory | *(empty)* |

The build step bundles individual RFC JSON files from `site/data/rfcs/` into `site/data/rfcs-bundle.js`, which the frontend loads at runtime. The deploy step uploads everything in `site/` as static assets to Cloudflare.

`wrangler.jsonc` at the repo root also declares the assets directory for wrangler.

## Project structure

```
site/                  Deployed static site
  index.html           Entry point
  app.js               Application code (vanilla JS, no framework)
  style.css            Styles
  data/rfcs/           Individual RFC JSON files (source of truth)
  data/rfcs-bundle.js  Generated bundle (do not edit directly)
scripts/
  build.js             Bundles RFC JSONs into rfcs-bundle.js
wrangler.jsonc         Cloudflare Workers asset config
flake.nix              Nix build & dev shell (alternative to npm)
```

## Local development

With Node.js:

```sh
node scripts/build.js
python3 -m http.server 8080 --directory site
```

With Nix:

```sh
nix develop   # enter dev shell
nix run       # build and serve on :8080
```

## Adding RFCs

Add a JSON file to `site/data/rfcs/` following the existing format (see any file in that directory for the schema). Run `node scripts/build.js` to regenerate the bundle. The build step on Cloudflare Pages handles this automatically on push.
