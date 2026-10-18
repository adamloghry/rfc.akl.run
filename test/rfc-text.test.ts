import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { missing, placeholder, refresh } from '../scripts/rfc-text/refresh';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfc-text-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const stub = (routes: Record<string, number | string>, calls: string[] = []): typeof fetch =>
  (async (url: string) => {
    calls.push(url);
    const r = routes[url.replace(/.*\/rfc\//, '')];
    if (typeof r === 'string') return new Response(r, { status: 200 });
    return new Response('nope', { status: r ?? 404 });
  }) as unknown as typeof fetch;

describe('rfc-text refresh', () => {
  it('fetches only missing texts and leaves existing files alone', async () => {
    fs.writeFileSync(path.join(dir, '1.txt'), 'old');
    const calls: string[] = [];
    const r = await refresh({ dir, issued: [1, 2], fetchImpl: stub({ 'rfc2.txt': 'two' }, calls), backoffMs: 0 });
    expect(calls).toEqual(['https://www.rfc-editor.org/rfc/rfc2.txt']);
    expect(r).toMatchObject({ wanted: 1, fetched: 1, failed: [] });
    expect(fs.readFileSync(path.join(dir, '1.txt'), 'utf8')).toBe('old');
    expect(fs.readFileSync(path.join(dir, '2.txt'), 'utf8')).toBe('two');
    expect(missing(dir, [1, 2, 3])).toEqual([3]);
  });

  it('writes a PDF placeholder on 404', async () => {
    const r = await refresh({ dir, issued: [8], fetchImpl: stub({}), backoffMs: 0 });
    expect(r.placeholders).toEqual([8]);
    const t = fs.readFileSync(path.join(dir, '8.txt'), 'utf8');
    expect(t).toBe(placeholder(8));
    expect(t).toContain('https://www.rfc-editor.org/rfc/rfc8.pdf');
  });

  it('retries server errors and reports persistent failures without writing a file', async () => {
    let n = 0;
    const flaky = (async () => (++n < 3 ? new Response('x', { status: 503 }) : new Response('ok'))) as unknown as typeof fetch;
    expect((await refresh({ dir, issued: [5], fetchImpl: flaky, backoffMs: 0 })).fetched).toBe(1);
    const r = await refresh({ dir, issued: [6], fetchImpl: stub({ 'rfc6.txt': 500 }), retries: 1, backoffMs: 0 });
    expect(r.failed).toEqual([{ number: 6, error: 'HTTP 500' }]);
    expect(fs.existsSync(path.join(dir, '6.txt'))).toBe(false);
  });

  it('rejects HTML bodies and treats empty files as missing', async () => {
    fs.writeFileSync(path.join(dir, '7.txt'), '');
    const r = await refresh({ dir, issued: [7], fetchImpl: stub({ 'rfc7.txt': '<!DOCTYPE html><html>' }), backoffMs: 0 });
    expect(r.failed[0].error).toMatch(/HTML/);
  });
});
