import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { fetchTexts, targets } from '../../scripts/explain/fetch-texts';
import { textPathFor } from '../../scripts/explain/lib';
import { type Fixture, makeFixture } from './helpers';

let fx: Fixture;
beforeEach(() => {
  fx = makeFixture();
});
afterEach(() => fx.cleanup());

const body = (s: string, status = 200, headers: Record<string, string> = {}) => new Response(s, { status, headers });

describe('fetch-texts', () => {
  test('targets are issued RFCs without sections', () => {
    fx.writeContent(900, { ...fx.readContent(900), sections: [{ id: 'introduction', title: 'x', content: '<p>x</p>' }] });
    const t = targets(fx.paths, fx.summary.issued);
    expect(t).not.toContain(900);
    expect(t).toContain(768);
  });

  test('downloads, retries 5xx, skips existing files, writes atomically, and falls back to the PDF', async () => {
    fs.writeFileSync(path.join(fx.paths.textDir, '768.txt'), 'already here');
    const calls: string[] = [];
    let flaky = 0;
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (url.endsWith('rfc900.txt') && flaky++ < 2) return body('busy', 503, { 'retry-after': '0' });
      if (url.endsWith('rfc901.txt')) return body('not found', 404);
      if (url.endsWith('rfc901.pdf')) return body('%PDF-1.4');
      if (url.endsWith('rfc8.pdf')) return body('%PDF-1.4 eight');
      if (url.endsWith('rfc903.txt')) return body('<!DOCTYPE html><html>error page</html>');
      if (url.endsWith('rfc905.txt')) return body('', 200);
      return body(`text of ${url}`);
    }) as unknown as typeof fetch;

    const r = await fetchTexts({
      paths: fx.paths,
      numbers: [768, 900, 901, 8, 903, 905, 906],
      fetchImpl,
      backoffMs: 0,
      retries: 3,
      concurrency: 4,
    });
    expect(r.total).toBe(7);
    expect(r.skipped).toBe(1);
    expect(r.fetched).toBe(4); // 900, 901 (as pdf), 8 (pdf), 906
    expect(r.pdf).toBe(2);
    expect(r.failed.map((f) => f.number)).toEqual([903, 905]);
    expect(r.failed[0].error).toMatch(/HTML/);

    const dir = fx.paths.textDir;
    expect(fs.readFileSync(path.join(dir, '768.txt'), 'utf8')).toBe('already here');
    expect(fs.readFileSync(path.join(dir, '900.txt'), 'utf8')).toContain('rfc900.txt');
    expect(fs.existsSync(path.join(dir, '901.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, '901.pdf'), 'utf8')).toBe('%PDF-1.4');
    expect(fs.readFileSync(path.join(dir, '8.pdf'), 'utf8')).toBe('%PDF-1.4 eight');
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    // PDF-only RFCs go straight to the .pdf URL; a 404 on .txt is not retried
    expect(calls.some((u) => u.endsWith('rfc8.txt'))).toBe(false);
    expect(calls.filter((u) => u.endsWith('rfc901.txt'))).toHaveLength(1);
    expect(calls.filter((u) => u.endsWith('rfc900.txt'))).toHaveLength(3);
  });

  test('gives up after the retries and reports the failure; a rerun picks up only the missing file', async () => {
    const down = (async () => body('down', 500)) as unknown as typeof fetch;
    const r = await fetchTexts({ paths: fx.paths, numbers: [906], fetchImpl: down, backoffMs: 0, retries: 2 });
    expect(r.failed).toEqual([{ number: 906, error: 'HTTP 500' }]);
    const up = (async () => body('now it works')) as unknown as typeof fetch;
    const again = await fetchTexts({ paths: fx.paths, numbers: [906, 907], fetchImpl: up, backoffMs: 0 });
    expect(again.fetched).toBe(2);
    const third = await fetchTexts({ paths: fx.paths, numbers: [906, 907], fetchImpl: down, backoffMs: 0 });
    expect(third.skipped).toBe(2);
    expect(third.failed).toEqual([]);
  });

  test('a .txt that only points at a PDF edition also fetches the PDF, and agents are pointed at the PDF', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.endsWith('rfc906.txt')) return body('RFC-906 "X" is available only in PostScript form in the file RFC906.PS');
      if (url.endsWith('rfc906.pdf')) return body('%PDF-1.3');
      return body(`text of ${url}`);
    }) as unknown as typeof fetch;
    const r = await fetchTexts({ paths: fx.paths, numbers: [906, 907], fetchImpl, backoffMs: 0 });
    expect(r.stubs).toEqual([{ number: 906, pdf: true }]);
    expect(textPathFor(fx.paths, 906)).toBe(path.join(fx.paths.textDir, '906.pdf'));
    expect(textPathFor(fx.paths, 907)).toBe(path.join(fx.paths.textDir, '907.txt'));
    expect(textPathFor(fx.paths, 418)).toBe(path.join(fx.paths.textDir, '418.pdf'));
    // a rerun neither refetches nor loses the stub report
    const again = await fetchTexts({ paths: fx.paths, numbers: [906], fetchImpl, backoffMs: 0 });
    expect(again.skipped).toBe(1);
    expect(again.stubs).toEqual([{ number: 906, pdf: true }]);
  });
});
