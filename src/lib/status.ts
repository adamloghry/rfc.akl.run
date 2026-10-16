/** C5 status map. */
export type StatusTone = 'green' | 'amber' | 'neutral';
export interface StatusInfo { key: string; label: string; tone: StatusTone }
const MAP: Record<string, StatusInfo> = {
  'INTERNET STANDARD': { key: 'internet-standard', label: 'Internet Standard', tone: 'green' },
  'DRAFT STANDARD': { key: 'draft-standard', label: 'Draft Standard', tone: 'green' },
  'PROPOSED STANDARD': { key: 'proposed-standard', label: 'Proposed Standard', tone: 'green' },
  'BEST CURRENT PRACTICE': { key: 'bcp', label: 'Best Current Practice', tone: 'neutral' },
  INFORMATIONAL: { key: 'informational', label: 'Informational', tone: 'neutral' },
  EXPERIMENTAL: { key: 'experimental', label: 'Experimental', tone: 'neutral' },
  HISTORIC: { key: 'historic', label: 'Historic', tone: 'amber' },
  UNKNOWN: { key: 'unknown', label: 'Unknown', tone: 'neutral' },
};

/** @param {string} raw index current-status, e.g. 'PROPOSED STANDARD'
 *  @returns {{key: string, label: string, tone: 'green'|'amber'|'neutral'}} throws on unknown value */
export function normalize(raw: string): StatusInfo {
  const hit = Object.prototype.hasOwnProperty.call(MAP, raw) ? MAP[raw] : null;
  if (!hit) throw new Error(`Unknown RFC status: ${JSON.stringify(raw)}`);
  return { ...hit };
}
