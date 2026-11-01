/**
 * The retired "ELI5" framing.
 *
 * The explainers are ISO Plain Language (ISO 24495-1:2023) explanations for an adult reader who does not work in
 * networking; the site labels them "ISO Plain Language" (see scripts/explain/SPEC.md section 8). The phrases below name the old kid-level
 * framing and the old reader description, so they must not come back in prose, in generated output or in site chrome.
 */

/** The label phrases: a literal name of the old framing, which no prose may carry. */
export const RETIRED_LABEL_FRAMING: { re: RegExp; label: string }[] = [
  { re: /\bELI5\b/i, label: 'ELI5' },
  { re: /like\s+i'?m\s+5\b/i, label: "Like I'm 5" },
];

/** The old reader description: only a plain-language text could talk about writing for a child. */
export const RETIRED_AUDIENCE_FRAMING: { re: RegExp; label: string }[] = [{ re: /\b(?:10|ten)[- ]year[- ]old\b/i, label: '10-year-old' }];

/** The retired framing found in a string, as labels; empty when the string is clean. */
export function checkRetiredFraming(s: string, includeAudience = false): string[] {
  const patterns = includeAudience ? [...RETIRED_LABEL_FRAMING, ...RETIRED_AUDIENCE_FRAMING] : RETIRED_LABEL_FRAMING;
  return patterns.filter(({ re }) => re.test(s)).map(({ label }) => label);
}

/** The error message the linter and the explainer validator use, so both say the same thing. */
export function retiredFramingMessage(label: string, found: string): string {
  return `retired ${label} framing (${found}); the explainers are ISO Plain Language (ISO 24495-1:2023) for an adult reader, so name the standard, never a child audience`;
}
