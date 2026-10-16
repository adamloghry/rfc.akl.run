/**
 * Refreshes the committed RFC Editor index snapshot (data/rfc-index.xml).
 *   node --import tsx scripts/refresh-index.ts [--url <file-or-url>]   (also: npm run refresh-index)
 * Fetches https://www.rfc-editor.org/rfc-index.xml, checks that it parses and has at least as many
 * entries as the current snapshot, then replaces the snapshot atomically. Prints "changed" or "unchanged".
 * This is the only code path that touches the network; builds read the snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchIndex, parseIndex, SNAPSHOT_PATH } from '../src/lib/rfc-index';

async function main(argv: string[]): Promise<number> {
  const urlArg = argv[0] === '--url' ? argv[1] : undefined;
  let xml: string;
  let count: number;
  if (urlArg) {
    xml = fs.readFileSync(urlArg, 'utf8'); // local file source, for testing the flow offline
    count = parseIndex(xml).entries.size;
  } else {
    const fetched = await fetchIndex();
    xml = fetched.xml;
    count = fetched.index.entries.size;
  }

  const target = path.resolve(SNAPSHOT_PATH);
  const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  const oldCount = old ? parseIndex(old).entries.size : 0;
  if (count < oldCount)
    throw new Error(`refresh-index: new index has ${count} entries, fewer than the snapshot's ${oldCount}; refusing to overwrite`);

  if (old === xml) {
    console.log(`refresh-index: unchanged (${count} entries)`);
    return 0;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, xml);
  fs.renameSync(tmp, target);
  console.log(`refresh-index: changed (${oldCount} -> ${count} entries) -> ${SNAPSHOT_PATH}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
