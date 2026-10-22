/**
 * The retired "ELI5" names, kept as aliases so old links and saved settings keep working.
 *
 * The tab, the reading level and the simulator lens were renamed to ISO Plain Language on 2026-10-18 (AGENTS.md). A
 * link like rfc.akl.run/rfc903#eli5, a ?level=eli5 query and a stored rfc-level / rfc-lens value of "eli5" are the
 * same request as the new names, so they resolve to ISO Plain Language instead of silently falling back to the
 * engineer text.
 */
export const LEGACY_PLAIN_LANGUAGE_NAMES = ['eli5'] as const;

/** True for the canonical name and for every legacy name that stands in for it. */
export function isPlainLanguageName(value: string | null | undefined): boolean {
  if (!value) return false;
  return value === 'plain-language' || (LEGACY_PLAIN_LANGUAGE_NAMES as readonly string[]).includes(value);
}

/** The canonical name for a legacy alias, or the value itself when it is not one. */
export function canonicalPlainLanguageName(value: string): string {
  return (LEGACY_PLAIN_LANGUAGE_NAMES as readonly string[]).includes(value) ? 'plain-language' : value;
}
