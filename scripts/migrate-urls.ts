/**
 * One-off migration of internal RFC links in content HTML to the slash-less URL scheme:
 *   href="/903/"          -> href="/rfc903"
 *   href='/903/#section'  -> href='/rfc903#section'
 * Only href attributes whose value is an internal RFC link are touched (code samples such as '/3802/' that are
 * not href values are left alone). Zero-padded numbers are normalised. The files are edited as text, so JSON
 * formatting stays byte-identical, and the script is idempotent: a second run changes nothing.
 *
 * Usage: node --import tsx scripts/migrate-urls.ts [--check] [dir...]
 *   Default dirs: content/rfcs content/journeys content/glossary. --check changes nothing and exits 1 when links remain.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// In raw JSON text a double-quoted attribute appears as \" ; a single-quoted one as '.
const OLD_HREF = /(href\s*=\s*(?:\\"|"|'))\/0*(\d+)\/?((?:#[^"'\\\s]*)?)(?=\\"|"|')/gi;

export interface MigrateResult {
  text: string;
  count: number;
}

export function migrateText(text: string): MigrateResult {
  let count = 0;
  const out = text.replace(OLD_HREF, (_m, pre: string, n: string, frag: string) => {
    count++;
    return `${pre}/rfc${Number(n)}${frag}`;
  });
  return { text: out, count };
}

export function migrateDirs(
  dirs: string[],
  write: boolean,
): { files: number; changedFiles: number; links: number; byDir: Record<string, number> } {
  const byDir: Record<string, number> = {};
  let files = 0;
  let changedFiles = 0;
  let links = 0;
  for (const dir of dirs) {
    byDir[dir] = 0;
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const p = path.join(dir, f);
      files++;
      const before = fs.readFileSync(p, 'utf8');
      const { text, count } = migrateText(before);
      if (count === 0) continue;
      changedFiles++;
      links += count;
      byDir[dir] += count;
      if (write) fs.writeFileSync(p, text);
    }
  }
  return { files, changedFiles, links, byDir };
}

if (import.meta.filename === process.argv[1]) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const given = args.filter((a) => !a.startsWith('--'));
  const dirs = (given.length ? given : ['content/rfcs', 'content/journeys', 'content/glossary']).map((d) => path.resolve(ROOT, d));
  const r = migrateDirs(dirs, !check);
  for (const [d, n] of Object.entries(r.byDir))
    console.log(`${path.relative(ROOT, d)}: ${n} link(s) ${check ? 'to migrate' : 'rewritten'}`);
  console.log(
    `${r.files} files scanned, ${r.changedFiles} ${check ? 'need changes' : 'changed'}, ${r.links} link(s) ${check ? 'remaining' : 'rewritten'}`,
  );
  if (check && r.links > 0) process.exit(1);
}
