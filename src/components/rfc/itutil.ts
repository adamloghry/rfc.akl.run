import type { RfcRecord } from '../../lib/model';

export const REPO = 'https://github.com/adamloghry/rfc.akl.run';
/** max relation links shown per list ("and N more" links to the graph) */
export const CAP = 12;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const TIER_LEVEL: Record<string, number> = { index: 1, summary: 2, explainer: 3, interactive: 4 };
export const LADDER: [string, string][] = [
  ['Index page', 'Metadata, lineage and backlinks from rfc-index.xml.'],
  ['Summary', 'Plain-language abstract and a one-paragraph ELI5. Small PR.'],
  ['Explainer', 'Sections, glossary terms and at least one diagram.'],
  ['Interactive', 'A simulation or explorable built from the shared viz library.'],
];
export const hasExplainer = (r?: RfcRecord | null): boolean => !!r && (r.tier === 'explainer' || r.tier === 'interactive');

export function starterUrl(rfc: RfcRecord): string {
  const starter = { number: rfc.number, category: rfc.category, summary: '', eli5: { summary: '' }, questions: [] };
  return `${REPO}/new/trunk/content/rfcs?filename=${rfc.number}.json&value=${encodeURIComponent(JSON.stringify(starter))}`;
}
