/**
 * The build date feeds "new" badges, priority decay, the feed and coverage.json, so reproducible
 * (Nix) builds must be able to pin it. Precedence: RFC_BUILD_DATE (ISO date or timestamp),
 * then SOURCE_DATE_EPOCH (seconds since the epoch, the reproducible-builds.org convention), then now.
 * A set-but-malformed value is an error rather than a silent fallback to the wall clock.
 */
export function resolveBuildDate(env: Record<string, string | undefined> = process.env, now: () => Date = () => new Date()): Date {
  const iso = env.RFC_BUILD_DATE?.trim();
  if (iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`RFC_BUILD_DATE is not a valid ISO date: ${JSON.stringify(iso)}`);
    return d;
  }
  const epoch = env.SOURCE_DATE_EPOCH?.trim();
  if (epoch) {
    if (!/^\d+$/.test(epoch)) throw new Error(`SOURCE_DATE_EPOCH is not an integer number of seconds: ${JSON.stringify(epoch)}`);
    return new Date(Number(epoch) * 1000);
  }
  return now();
}
