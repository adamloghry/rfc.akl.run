'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const CSS_DIR = path.join(ROOT, 'src', 'assets', 'css');
const JS_DIR = path.join(ROOT, 'src', 'assets', 'js');
const FONT_ROOT = path.join(ROOT, 'node_modules', '@fontsource');

// C11 order; missing files are skipped so later tasks' files are picked up automatically.
const CSS_ORDER = ['tokens', 'base', 'chrome', 'content', 'viz', 'reader', 'index-tier', 'atlas', 'pages', 'print'];

const FONTS = [
  { pkg: 'ibm-plex-sans', family: 'IBM Plex Sans', weights: [400, 500, 600, 700], styles: ['normal'] },
  { pkg: 'ibm-plex-mono', family: 'IBM Plex Mono', weights: [400, 500, 600], styles: ['normal'] },
  { pkg: 'ibm-plex-serif', family: 'IBM Plex Serif', weights: [400], styles: ['normal', 'italic'] },
];

let manifest = null;

const hash8 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
const hashed = (name, h) => name.replace(/(\.[^.]+)$/, `.${h}$1`);

/** Copies, concatenates and hashes assets into outDir, then sets the manifest.
 *  @param {string} outDir @returns {Record<string, string>} */
function build(outDir) {
  const assetsDir = path.join(outDir, 'assets');
  const fontsDir = path.join(assetsDir, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });
  const m = {};

  // Fonts + @font-face rules
  let faces = '';
  for (const f of FONTS) {
    for (const style of f.styles) {
      for (const w of f.weights) {
        const file = `${f.pkg}-latin-${w}-${style}.woff2`;
        const src = path.join(FONT_ROOT, f.pkg, 'files', file);
        if (!fs.existsSync(src)) throw new Error(`assets: font not found: ${src}`);
        const buf = fs.readFileSync(src);
        const out = hashed(file, hash8(buf));
        fs.writeFileSync(path.join(fontsDir, out), buf);
        m[file] = `/assets/fonts/${out}`;
        faces += `@font-face{font-family:'${f.family}';font-style:${style};font-weight:${w};font-display:swap;src:url(${m[file]}) format('woff2')}\n`;
      }
    }
  }

  // CSS bundle
  let css = faces;
  for (const name of CSS_ORDER) {
    const p = path.join(CSS_DIR, name + '.css');
    if (fs.existsSync(p)) css += `/* ${name}.css */\n` + fs.readFileSync(p, 'utf8') + '\n';
  }
  const cssName = hashed('site.css', hash8(css));
  fs.writeFileSync(path.join(assetsDir, cssName), css);
  m['site.css'] = `/assets/${cssName}`;

  // JS (each file hashed individually)
  if (fs.existsSync(JS_DIR)) {
    for (const f of fs.readdirSync(JS_DIR).filter((n) => n.endsWith('.js')).sort()) {
      const buf = fs.readFileSync(path.join(JS_DIR, f));
      const out = hashed(f, hash8(buf));
      fs.writeFileSync(path.join(assetsDir, out), buf);
      m[f] = `/assets/${out}`;
    }
  }

  manifest = m;
  return m;
}

/** @param {string} name e.g. 'site.css' @returns {string} hashed URL, or '/assets/<name>' with no manifest */
function url(name) {
  if (!manifest) return '/assets/' + name;
  if (!manifest[name]) throw new Error(`assets.url: '${name}' is not in the asset manifest`);
  return manifest[name];
}

/** @param {Record<string, string>|null} m */
function useManifest(m) { manifest = m; }

/** @param {string} name */
function has(name) { return !manifest || Boolean(manifest[name]); }

module.exports = { build, url, useManifest, has };
