import type { RfcRecord } from '../../lib/model';

/** max relation links shown per list ("and N more" links to the graph) */
export const CAP = 12;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const hasExplainer = (r?: RfcRecord | null): boolean => !!r && (r.tier === 'explainer' || r.tier === 'interactive');
