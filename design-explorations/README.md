# Design explorations

Three colorful redesign directions, applied as CSS overrides on top of the
current `site/style.css`. Nothing here ships — these are sketches to compare.

## Variants

- `variants/neon.css` — **Neon / Synthwave.** Deep indigo base, magenta+cyan+lime
  accents, gradient title, strong glows. Pushes the existing dark theme toward
  vaporwave; per-RFC hero color floods the page with a saturated gradient.
- `variants/editorial.css` — **Editorial / Print.** Cream paper background, big
  serif display headings (DM Serif Display), navy ink text, vermillion+ochre
  accents, blocky offset shadows, no glow. Feels like a printed magazine or
  monograph.
- `variants/topology.css` — **Topology Cards.** Light off-white background, each
  sidebar category gets its own bright color, rounded cards with thick colored
  borders, status pills in solid pastel chips. Closest to a modern docs site
  (Vercel/Linear/Resend) but more saturated.

## Try one locally

```sh
node scripts/build.js
python3 -m http.server 8080 --directory site &

# Then in another terminal:
node design-explorations/scripts/snap.js \
  "http://127.0.0.1:8080/" \
  /tmp/preview.png \
  top \
  design-explorations/variants/neon.css
```

Or, to preview a variant in your own browser, append a `<style>` tag to
`site/index.html` that `@import`s the variant file — e.g. add this just
before `</head>`:

```html
<style>@import url('../design-explorations/variants/neon.css');</style>
```

## Notes on the variants as code

- Each variant is a CSS overlay (uses `!important` heavily) so the existing
  stylesheet stays untouched.
- They override the CSS custom properties in `:root` plus a handful of
  high-impact selectors (topbar, sidebar, cards, hero, headings, code blocks).
- They reuse the existing per-RFC `--hero-accent` so different RFCs still
  get distinct color treatments.
- If we pick one direction, the real implementation should edit `site/style.css`
  directly rather than layering on top.
