/**
 * Keeps the committed snapshot of the original RFC texts (data/rfc-text/<n>.txt) in step with data/rfc-index.xml.
 *   node --import tsx scripts/rfc-text/refresh.ts [--verify] [--dir <dir>]   (also: npm run rfc-text:refresh)
 * Fetches https://www.rfc-editor.org/rfc/rfc<n>.txt for every issued RFC that has no file yet. An RFC with no
 * text edition (404) gets a placeholder that points at the PDF. With --verify nothing is fetched: the exit code
 * is non-zero when any issued RFC has no file. Builds read the snapshot, so they never need the network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadIndex } from '../../src/lib/rfc-index';

export const BASE_URL = 'https://www.rfc-editor.org/rfc';
export const TEXT_DIR = path.join('data', 'rfc-text');

export interface RefreshOptions {
  dir?: string;
  issued: number[];
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  concurrency?: number;
  retries?: number;
  /** base delay in ms for the exponential backoff (tests pass 0) */
  backoffMs?: number;
  log?: (s: string) => void;
}

export interface RefreshReport {
  wanted: number;
  fetched: number;
  placeholders: number[];
  failed: { number: number; error: string }[];
}

export const textFile = (dir: string, n: number): string => path.join(dir, `${n}.txt`);

export function missing(dir: string, issued: number[]): number[] {
  return issued.filter((n) => {
    try {
      return fs.statSync(textFile(dir, n)).size === 0;
    } catch {
      return true;
    }
  });
}

export function placeholder(n: number, baseUrl = BASE_URL): string {
  return `[rfc.akl.run: the RFC Editor publishes RFC ${n} only as a PDF, so no plain text is available here. Read it at ${baseUrl}/rfc${n}.pdf]\n`;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`HTTP ${status}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string, f: typeof fetch): Promise<Buffer> {
  const res = await f(url, { signal: AbortSignal.timeout(90_000), headers: { 'user-agent': 'rfc.akl.run rfc-text snapshot' } });
  if (res.status !== 200) {
    const ra = Number(res.headers.get('retry-after'));
    throw new HttpError(res.status, Number.isFinite(ra) && ra > 0 ? ra * 1000 : null);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('empty body');
  if (/^\s*<!doctype html|^\s*<html/i.test(buf.subarray(0, 200).toString('latin1'))) throw new Error('got an HTML page instead of text');
  return buf;
}

async function withRetry(url: string, f: typeof fetch, retries: number, backoffMs: number): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await download(url, f);
    } catch (e) {
      last = e;
      if (e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 429 && e.status !== 408) throw e;
      if (attempt === retries) break;
      const wait = (e instanceof HttpError && e.retryAfterMs) || backoffMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await sleep(Math.min(wait, 60_000));
    }
  }
  throw last;
}

function writeAtomic(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export async function refresh(opts: RefreshOptions): Promise<RefreshReport> {
  const dir = opts.dir ?? TEXT_DIR;
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? BASE_URL;
  const log = opts.log ?? (() => {});
  const todo = missing(dir, opts.issued);
  const report: RefreshReport = { wanted: todo.length, fetched: 0, placeholders: [], failed: [] };
  let next = 0;
  const worker = async () => {
    for (;;) {
      const n = todo[next++];
      if (n === undefined) return;
      try {
        const body = await withRetry(`${base}/rfc${n}.txt`, f, opts.retries ?? 5, opts.backoffMs ?? 1000);
        writeAtomic(textFile(dir, n), body);
        report.fetched++;
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) {
          writeAtomic(textFile(dir, n), placeholder(n, base));
          report.placeholders.push(n);
        } else report.failed.push({ number: n, error: (e as Error).message });
      }
      if ((report.fetched + report.placeholders.length + report.failed.length) % 250 === 0) log(`rfc-text: ${next}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  report.placeholders.sort((a, b) => a - b);
  report.failed.sort((a, b) => a.number - b.number);
  return report;
}

async function main(argv: string[]): Promise<number> {
  let verify = false;
  let dir = TEXT_DIR;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--verify') verify = true;
    else if (argv[i] === '--dir') dir = argv[++i];
    else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  const issued = [...loadIndex().entries.keys()].sort((a, b) => a - b);
  if (verify) {
    const gone = missing(dir, issued);
    if (gone.length) {
      console.error(
        `rfc-text: ${gone.length} of ${issued.length} issued RFCs have no text: ${gone.slice(0, 20).join(', ')}${gone.length > 20 ? ', ...' : ''}`,
      );
      return 1;
    }
    console.log(`rfc-text: all ${issued.length} issued RFCs present in ${dir}`);
    return 0;
  }
  const r = await refresh({ dir, issued, log: (s) => console.log(s) });
  console.log(
    `rfc-text: ${r.wanted} missing, ${r.fetched} fetched, ${r.placeholders.length} PDF-only placeholders, ${r.failed.length} failed`,
  );
  for (const x of r.failed.slice(0, 40)) console.log(`  failed ${x.number}: ${x.error}`);
  return r.failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e);
      process.exit(2);
    },
  );
}
