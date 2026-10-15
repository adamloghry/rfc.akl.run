'use strict';
const fs = require('node:fs');
const path = require('node:path');
const status = require('./status');
const areas = require('./areas');
const graph = require('./graph');
const priority = require('./priority');
const { checkContent } = require('./sanitize-check');
/** @typedef {{
 *  number: number, slug: string|null, editors: string[], indexAuthors: string[], indexTitle: string,
 *  title: string, shortTitle: string|null, authors: string[], organization: string|null,
 *  year: number, month: number, day: number|null, dateLabel: string,
 *  status: string, statusLabel: string, statusTone: 'green'|'amber'|'neutral',
 *  stream: string|null, area: string|null, wg: string|null, abstract: string|null,
 *  keywords: string[], pageCount: number|null, doi: string|null, errataUrl: string|null, isAlso: string[],
 *  obsoletes: number[], obsoletedBy: number[], updates: number[], updatedBy: number[],
 *  category: string, categoryReviewed: boolean,
 *  tier: 'index'|'summary'|'explainer'|'interactive',
 *  content: object|null,
 *  isNew: boolean,
 *  mentionedIn: number[],
 *  journeys: string[],
 *  priority: number,
 *  demand: number,
 *  url: string
 * }} RfcRecord
 *
 * @typedef {{
 *  buildDate: Date, max: number,
 *  rfcs: Map<number, RfcRecord>,
 *  notIssued: Set<number>,
 *  reserved: Set<number>,
 *  journeys: object[], glossary: Map<string, object>,
 *  categories: {key: string, name: string}[],
 *  counts: {total: number, index: number, summary: number, explainer: number, interactive: number},
 *  newest: RfcRecord[]
 * }} Site */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
}

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: path.join(dir, f), data: readJson(path.join(dir, f)) }));
}

/** Build-time guard (same validator as lint): throws on the first unsafe raw()-rendered HTML field. */
function assertSafeHtml(kind, dirName, file, data) {
  const [bad] = checkContent(data, kind);
  if (bad) throw new Error(`content/${dirName}/${path.basename(file)}: unsafe HTML at ${bad.ptr}: ${bad.problem}`);
}

function tierOf(content) {
  if (!content) return 'index';
  if ((content.viz || []).some((v) => v.type === 'sequence-sim')) return 'interactive';
  if (Array.isArray(content.sections) && content.sections.length) return 'explainer';
  if (typeof content.summary === 'string' && content.summary.trim()) return 'summary';
  return 'index';
}

/** @param {{index: {entries: Map<number, object>, notIssued: Set<number>, max: number}, contentDir?: string, buildDate?: Date}} opts
 *  @returns {Site} */
function buildSite(opts) {
  const { index } = opts;
  const contentDir = opts.contentDir || 'content';
  const buildDate = opts.buildDate || new Date();
  const legacy = new Set(readJson(path.join(contentDir, 'legacy-reviewed.json'), []));
  const demand = readJson(path.join(contentDir, 'signals', 'demand.json'), {});
  const traffic = readJson(path.join(contentDir, 'signals', 'traffic.json'), {});

  const contents = new Map();
  for (const { file, data } of readDir(path.join(contentDir, 'rfcs'))) {
    if (!index.entries.has(data.number)) throw new Error(`${file}: RFC ${data.number} is not in the RFC index`);
    assertSafeHtml('rfc', 'rfcs', file, data);
    contents.set(data.number, data);
  }

  const rfcs = new Map();
  for (const [number, e] of index.entries) {
    const c = contents.get(number) || null;
    const st = status.normalize(e.status);
    const day = e.day || new Date(Date.UTC(e.year, e.month, 0)).getUTCDate();
    const ageDays = Math.floor((buildDate - Date.UTC(e.year, e.month - 1, day)) / 86400000);
    rfcs.set(number, {
      number,
      slug: (c && c.slug) || null,
      title: (c && c.title) || e.title,
      shortTitle: (c && c.shortTitle) || null,
      authors: c && c.authors && c.authors.length ? c.authors : e.authors,
      editors: e.editors || [],
      indexAuthors: e.authors,
      indexTitle: e.title,
      organization: (c && c.organization) || null,
      year: e.year, month: e.month, day: e.day || null,
      dateLabel: `${MONTHS[e.month - 1]} ${e.year}`,
      status: st.key, statusLabel: st.label, statusTone: st.tone,
      stream: e.stream, area: e.area, wg: e.wg, abstract: e.abstract,
      keywords: e.keywords, pageCount: e.pageCount, doi: e.doi, errataUrl: e.errataUrl, isAlso: e.isAlso,
      obsoletes: e.obsoletes, obsoletedBy: e.obsoletedBy, updates: e.updates, updatedBy: e.updatedBy,
      category: (c && c.category) || areas.guessCategory(e),
      categoryReviewed: !!((c && c.categoryReviewed === true) || legacy.has(number)),
      tier: tierOf(c),
      content: c,
      isNew: ageDays <= 30,
      mentionedIn: [],
      journeys: [],
      priority: 0,
      demand: Number(demand[number]) || 0,
      url: `/${number}/`,
    });
  }

  const journeys = readDir(path.join(contentDir, 'journeys')).map((x) => x.data);
  for (const j of journeys) {
    for (const step of j.steps || []) {
      for (const ref of step.rfcs || []) {
        const r = rfcs.get(ref.number);
        if (r && !r.journeys.includes(j.slug)) r.journeys.push(j.slug);
      }
    }
  }

  const glossary = new Map();
  for (const { file, data } of readDir(path.join(contentDir, 'glossary'))) {
    assertSafeHtml('glossary', 'glossary', file, data);
    glossary.set(data.id, { ...data, rfcs: data.rfcs || [], usedBy: [] });
  }
  for (const r of rfcs.values()) {
    for (const id of (r.content && r.content.glossary) || []) {
      const t = glossary.get(id);
      if (t && !t.usedBy.includes(r.number)) t.usedBy.push(r.number);
    }
  }
  for (const t of glossary.values()) t.usedBy.sort((a, b) => a - b);

  const reserved = new Set();
  for (let n = 1; n <= index.max; n++) if (!rfcs.has(n) && !index.notIssued.has(n)) reserved.add(n);

  const counts = { total: rfcs.size, index: 0, summary: 0, explainer: 0, interactive: 0 };
  for (const r of rfcs.values()) counts[r.tier]++;

  const site = {
    buildDate, max: index.max, rfcs, notIssued: new Set(index.notIssued), reserved,
    journeys, glossary, categories: areas.CATEGORIES.map((c) => ({ ...c })), counts, newest: [],
  };

  graph.mentions(site);
  for (const r of rfcs.values()) r.priority = priority.score(r, site, Number(traffic[r.number]) || 0);
  site.newest = [...rfcs.values()].sort((a, b) => graph.byDate(b, a)).slice(0, 10);
  return site;
}

module.exports = { buildSite };
