export const sizeLabel = (bits: number) => (bits % 8 === 0 ? `${bits / 8} byte${bits === 8 ? '' : 's'}` : `${bits} bits`);

/** Split a display value across fragments, proportionally to bit counts, on ":" / "." separators. */
export function splitValue(value: any, fragBits: number[], totalBits: number): string[] {
  const s = String(value ?? '');
  if (fragBits.length === 1) return [s];
  const parts = s.split(/(?=[:.])/);
  if (parts.length < fragBits.length) return [s, ...fragBits.slice(1).map(() => '')];
  const out: string[] = [];
  let used = 0;
  let acc = 0;
  for (let i = 0; i < fragBits.length; i++) {
    acc += fragBits[i];
    const upto = i === fragBits.length - 1 ? parts.length : Math.round((parts.length * acc) / totalBits);
    out.push(parts.slice(used, upto).join(''));
    used = upto;
  }
  return out;
}

export function valueFor(field: any, modeKey: string) {
  if (field.values && modeKey && field.values[modeKey] !== undefined) return field.values[modeKey];
  if (field.value !== undefined) return field.value;
  if (field.values) return Object.values(field.values)[0];
  return '';
}

/** Lay fields out on a `width`-column grid; wide fields split across rows. */
export function layout(fields: any[], width: number) {
  const frags: { field: any; bits: number; part: number; parts: number; fragBits: number[] }[] = [];
  let col = 0;
  for (const f of fields) {
    let left = f.bits;
    const fragBits: number[] = [];
    while (left > 0) {
      const take = Math.min(left, width - col);
      fragBits.push(take);
      left -= take;
      col = (col + take) % width;
    }
    fragBits.forEach((bits, i) => frags.push({ field: f, bits, part: i, parts: fragBits.length, fragBits }));
  }
  return frags;
}

export function changedMode(field: any, modes: any[]): string | null {
  if (!field.values || modes.length < 2) return null;
  const base = String(valueFor(field, modes[0].key));
  const diff = modes.slice(1).find((m) => String(valueFor(field, m.key)) !== base);
  return diff ? diff.key : null;
}
