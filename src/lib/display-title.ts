// Shared "shortTitle: title" composition (Datasheet H1, page <title>, search results).
// Pure and dependency-free so client scripts can import it too.

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(?:the|a|an) /, '');

/** "short: title", or just title when the short name is already part of it. */
export function displayTitle(shortTitle: string | null | undefined, title: string): string {
  const short = (shortTitle || '').trim();
  if (!short || short === title) return title;
  const ns = norm(short);
  if (!ns) return title;
  if (` ${norm(title)} `.includes(` ${ns} `)) return title;
  // An acronym already present in the title, e.g. "Transmission Control Protocol (TCP)".
  if (/^[A-Z][A-Z0-9]+$/.test(short) && title.split(/[^A-Za-z0-9]+/).includes(short)) return title;
  return `${short}: ${title}`;
}
