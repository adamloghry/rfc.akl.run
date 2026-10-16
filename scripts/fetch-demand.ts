#!/usr/bin/env tsx
// @ts-nocheck -- ported from CommonJS; loosely typed on purpose
/**
 * Reader demand signal: open issues labeled `explainer-request` in
 * adamloghry/rfc.akl.run. The RFC number is parsed from the title; each issue
 * contributes (reactions.total_count + 1) to that number. Writes
 * content/signals/demand.json as {"903": 3}.
 *
 * Without GITHUB_TOKEN: logs and exits 0 (leaves any existing file alone).
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'adamloghry/rfc.akl.run';
const OUT = path.join(process.cwd(), 'content', 'signals', 'demand.json');

/** "Please explain RFC 903", "rfc0903", "RFC-903: ..." → 903; none → null */
export function parseRfcNumber(title) {
  const m = /\bRFC[\s-]*0*(\d{1,5})\b/i.exec(String(title || ''));
  return m ? Number(m[1]) : null;
}

export function tally(issues) {
  const demand: Record<number, number> = {};
  for (const issue of issues) {
    if (issue.pull_request) continue; // the issues API also returns PRs
    const n = parseRfcNumber(issue.title);
    if (!n) continue;
    const w = ((issue.reactions && issue.reactions.total_count) || 0) + 1;
    demand[n] = (demand[n] || 0) + w;
  }
  return demand;
}

async function fetchAll(token) {
  const issues = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${REPO}/issues?state=open&labels=explainer-request&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'rfc-akl-run-build' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
    const batch = await res.json();
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  return issues;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { console.log('fetch-demand: GITHUB_TOKEN not set; skipping.'); return; }
  const demand = tally(await fetchAll(token));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(demand, null, 2) + '\n');
  console.log(`fetch-demand: ${Object.keys(demand).length} RFC(s) with demand -> ${path.relative(process.cwd(), OUT)}`);
}

if (/(^|[\\/])fetch-demand\.ts$/.test(process.argv[1] || '')) main().catch((e) => { console.error(e.message); process.exit(1); });
