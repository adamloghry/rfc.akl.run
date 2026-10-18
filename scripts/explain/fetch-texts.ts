/**
 * Mirrors RFC texts for every issued RFC that has no `sections` in content/rfcs into .work/rfc-text/<n>.txt
 * (PDF-only RFCs go to <n>.pdf). Concurrency 4, retry with backoff, existing files are skipped, writes are atomic.
 *
 * CLI: node --import tsx scripts/explain/fetch-texts.ts [--all] [--limit N] [n...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { defaultPaths, isExplained, isMain, loadSummary, type Paths, PDF_ONLY, readContent, writeAtomic } from './lib';

export const BASE_URL = 'https://www.rfc-editor.org/rfc';

export interface FetchOptions {
  paths?: Paths;
  numbers?: number[];
  concurrency?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  /** base delay in ms for the exponential backoff (tests pass 0) */
  backoffMs?: number;
  baseUrl?: string;
  log?: (s: string) => void;
}

export interface FetchReport {
  total: number;
  skipped: number;
  fetched: number;
  pdf: number;
  /** .txt files that only point at a PostScript/PDF edition; the PDF was fetched too when the RFC Editor has one */
  stubs: { number: number; pdf: boolean }[];
  failed: { number: number; error: string }[];
}

/** Issued RFCs that still need a text: no `sections` in content. */
export function targets(paths: Paths, issued: number[]): number[] {
  return issued.filter((n) => !isExplained(readContent(paths, n)));
}

const STUB_BYTES = 1500;
export const isStub = (b: Buffer): boolean =>
  b.length < STUB_BYTES && /available (only )?in|PostScript|\bPDF\b|\.PS\b/i.test(b.toString('latin1'));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`HTTP ${status}`);
  }
}

async function download(url: string, f: typeof fetch): Promise<Buffer> {
  const res = await f(url, { signal: AbortSignal.timeout(90_000), headers: { 'user-agent': 'rfc.akl.run explainer text mirror' } });
  if (res.status !== 200) {
    const ra = Number(res.headers.get('retry-after'));
    throw new HttpError(res.status, Number.isFinite(ra) && ra > 0 ? ra * 1000 : null);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('empty body');
  return buf;
}

async function withRetry(url: string, f: typeof fetch, retries: number, backoffMs: number): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await download(url, f);
    } catch (e) {
      last = e;
      if (e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 429 && e.status !== 408) throw e; // 404 etc: do not retry
      if (attempt === retries) break;
      const wait = (e instanceof HttpError && e.retryAfterMs) || backoffMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await sleep(Math.min(wait, 60_000));
    }
  }
  throw last;
}

export async function fetchTexts(opts: FetchOptions = {}): Promise<FetchReport> {
  const paths = opts.paths ?? defaultPaths();
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? BASE_URL;
  const log = opts.log ?? (() => {});
  const numbers = opts.numbers ?? targets(paths, loadSummary(paths).issued);
  const report: FetchReport = { total: numbers.length, skipped: 0, fetched: 0, pdf: 0, failed: [], stubs: [] };
  fs.mkdirSync(paths.textDir, { recursive: true });
  let next = 0;
  let done = 0;

  const retries = opts.retries ?? 5;
  const backoff = opts.backoffMs ?? 1000;

  /** A tiny .txt saying the RFC exists only as PS/PDF: fetch the PDF edition as well, when there is one. */
  const handleStub = async (n: number, txt: Buffer) => {
    if (!isStub(txt)) return;
    const pdf = path.join(paths.textDir, `${n}.pdf`);
    let got = fs.existsSync(pdf);
    if (!got) {
      try {
        writeAtomic(pdf, await withRetry(`${base}/rfc${n}.pdf`, f, retries, backoff));
        got = true;
      } catch {
        // no PDF edition (404): agents fall back to the stub text and the existing summary
      }
    }
    report.stubs.push({ number: n, pdf: got });
  };

  const one = async (n: number) => {
    const dest = path.join(paths.textDir, `${n}.${PDF_ONLY.includes(n) ? 'pdf' : 'txt'}`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      report.skipped++;
      if (dest.endsWith('.txt') && fs.statSync(dest).size < STUB_BYTES) await handleStub(n, fs.readFileSync(dest));
      return;
    }
    const isPdf = PDF_ONLY.includes(n);
    try {
      let body: Buffer;
      let target = dest;
      try {
        body = await withRetry(`${base}/rfc${n}.${isPdf ? 'pdf' : 'txt'}`, f, retries, backoff);
      } catch (e) {
        // A .txt 404 for an RFC not on the known list: fall back to the PDF so agents still have a source.
        if (!isPdf && e instanceof HttpError && e.status === 404) {
          body = await withRetry(`${base}/rfc${n}.pdf`, f, retries, backoff);
          target = path.join(paths.textDir, `${n}.pdf`);
        } else throw e;
      }
      if (target.endsWith('.txt') && /^\s*<!doctype html|^\s*<html/i.test(body.subarray(0, 200).toString('latin1'))) {
        throw new Error('got an HTML page instead of text');
      }
      writeAtomic(target, body);
      if (target.endsWith('.pdf')) report.pdf++;
      report.fetched++;
      if (target.endsWith('.txt') && body.length < STUB_BYTES) await handleStub(n, body);
    } catch (e) {
      report.failed.push({ number: n, error: (e as Error).message });
    }
  };

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= numbers.length) return;
      await one(numbers[i]);
      if (++done % 250 === 0)
        log(
          `fetch-texts: ${done}/${numbers.length} (fetched ${report.fetched}, skipped ${report.skipped}, failed ${report.failed.length})`,
        );
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  report.failed.sort((a, b) => a.number - b.number);
  return report;
}

async function main(argv: string[]): Promise<number> {
  const paths = defaultPaths();
  const nums: number[] = [];
  let limit = Infinity;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') limit = Number(argv[++i]);
    else if (/^\d+$/.test(argv[i])) nums.push(Number(argv[i]));
    else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  const numbers = (nums.length ? nums : targets(paths, loadSummary(paths).issued)).slice(0, limit);
  const r = await fetchTexts({ paths, numbers, log: (s) => console.log(s) });
  console.log(
    `fetch-texts: ${r.total} wanted, ${r.skipped} already present, ${r.fetched} fetched (${r.pdf} as PDF), ${r.failed.length} failed`,
  );
  if (r.failed.length) {
    writeAtomic(paths.fetchFailuresFile, `${JSON.stringify(r.failed, null, 2)}\n`);
    for (const x of r.failed.slice(0, 40)) console.log(`  failed ${x.number}: ${x.error}`);
    console.log(`  failures written to ${path.relative(paths.root, paths.fetchFailuresFile)}`);
  } else if (fs.existsSync(paths.fetchFailuresFile)) fs.rmSync(paths.fetchFailuresFile);
  return r.failed.length ? 1 : 0;
}

if (isMain(import.meta.filename)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e);
      process.exit(2);
    },
  );
}
