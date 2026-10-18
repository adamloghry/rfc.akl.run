import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { renderSpec, SPEC_FILE, sanitizerAllowlist, specIsFresh } from '../../scripts/explain/gen-spec';
import { PROMPT_VERSION } from '../../scripts/explain/lib';
import { GENERATED_VIZ_TYPES, strictVizData, VIZ_EXAMPLES } from '../../scripts/explain/vizshape';
import { SECTION_IDS } from '../../scripts/explain/vocab';
import { validateViz } from '../../src/components/viz/validate';
import { checkHtml } from '../../src/lib/sanitize-check';

describe('SPEC.md', () => {
  test('is up to date (run `npm run explain:spec` after changing the validator)', () => {
    expect(specIsFresh()).toBe(true);
  });

  test('renderSpec is stable and complains about unknown blocks', () => {
    const cur = fs.readFileSync(SPEC_FILE, 'utf8');
    expect(renderSpec(cur)).toBe(cur);
    expect(() => renderSpec('<!-- BEGIN GENERATED nope -->\n<!-- END GENERATED nope -->')).toThrow(/unknown generated block/);
    expect(() => renderSpec('no blocks here')).toThrow(/lacks the generated block/);
  });

  test('states the version and the key rules', () => {
    const spec = fs.readFileSync(SPEC_FILE, 'utf8');
    expect(spec).toContain(`promptVersion: "${PROMPT_VERSION}"`);
    expect(spec).toContain('validate.ts');
    expect(spec).toContain('Do not finish until');
    expect(spec).toContain('content/rfcs/9293.json');
    expect(spec).not.toMatch(/`sequence-sim`[^.]*is allowed/);
    for (const id of SECTION_IDS) expect(spec).toContain(`\`${id}\``);
  });

  test("the HTML allowlist in the doc is the sanitizer's", () => {
    const { tags, attrs } = sanitizerAllowlist();
    const spec = fs.readFileSync(SPEC_FILE, 'utf8');
    for (const t of [...tags, ...attrs]) expect(spec).toContain(`\`${t}\``);
    for (const t of tags) expect(checkHtml(`<${t}>x</${t}>`).filter((p) => p.startsWith('tag not allowed'))).toEqual([]);
    expect(checkHtml('<script>x</script>')).not.toEqual([]);
    expect(tags).not.toContain('script');
  });

  test('every documented viz shape passes both validators and sequence-sim is excluded', () => {
    expect(GENERATED_VIZ_TYPES).not.toContain('sequence-sim');
    expect(GENERATED_VIZ_TYPES).toHaveLength(11);
    for (const t of GENERATED_VIZ_TYPES) {
      const ex = VIZ_EXAMPLES[t];
      expect(ex, t).toBeDefined();
      expect(
        strictVizData(t, ex.data, 'data', (n) => n === 793),
        t,
      ).toEqual([]);
      expect(validateViz({ type: t, anchor: 'x', caption: 'c', data: ex.data }), t).toBeNull();
    }
    expect(Object.keys(VIZ_EXAMPLES).sort()).toEqual([...GENERATED_VIZ_TYPES].sort());
  });
});
