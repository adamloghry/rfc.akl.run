import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Content } from '../../scripts/explain/lib';
import { type Env, loadEnv, validateFile, validateOutput } from '../../scripts/explain/validate';
import { type Fixture, makeFixture, validOutput } from './helpers';

let fx: Fixture;
let env: Env;
beforeAll(() => {
  fx = makeFixture();
  env = loadEnv(fx.paths, fx.summary);
  env.today = '2026-10-16';
});
afterAll(() => fx.cleanup());

const errorsFor = (mut: (o: Content) => void, n = 768): string[] => {
  const o = validOutput();
  mut(o);
  return validateOutput(n, o, env);
};
const has = (errs: string[], text: string) =>
  expect(
    errs.some((e) => e.includes(text)),
    `expected an error containing "${text}" in:\n${errs.join('\n')}`,
  ).toBe(true);

describe('validate', () => {
  test('the valid fixture passes', () => {
    expect(validOutput().glossaryTerms).toHaveLength(1);
    expect(validateOutput(768, validOutput(), env)).toEqual([]);
  });

  test('RFC content may mention GitHub (the site chrome may not; check-dist enforces that)', () => {
    expect(validateOutput(768, { ...validOutput(), today: '<p>Test vectors live in a GitHub repository.</p>' }, env)).toEqual([]);
  });

  test('extra and missing top-level keys', () => {
    const e = errorsFor((o) => {
      o.provenance = { source: 'human' };
      o.status = 'x';
      delete o.tldr;
    });
    has(e, 'unexpected top-level key "provenance"');
    has(e, 'unexpected top-level key "status"');
    has(e, 'missing required key "tldr"');
    expect(e[0]).toMatch(/^1\. /);
  });

  test('plainLanguage.summary is required (it replaces the old one)', () => {
    expect(errorsFor((o) => delete o.plainLanguage).some((e) => e.includes('plainLanguage'))).toBe(true);
    expect(errorsFor((o) => (o.plainLanguage = {})).some((e) => e.includes('plainLanguage.summary'))).toBe(true);
  });

  test('extra keys inside nested objects are rejected', () => {
    has(
      errorsFor((o) => (o.sections[0].extra = 1)),
      'unexpected key "extra"',
    );
    has(
      errorsFor((o) => (o.tldr.extra = 'x')),
      'tldr: unexpected key "extra"',
    );
    has(
      errorsFor((o) => (o.facts[0].extra = 'x')),
      'unexpected key "extra"',
    );
  });

  test('section ids: vocabulary, escape hatch, duplicates, count bounds', () => {
    has(
      errorsFor((o) => (o.sections[0].id = 'my-own-id')),
      'not in the section-id vocabulary',
    );
    expect(errorsFor((o) => (o.sections[2].id = 'section-7'))).toEqual([]);
    has(
      errorsFor((o) => (o.sections[2].id = 'introduction')),
      'duplicate section id',
    );
    has(
      errorsFor((o) => o.sections.pop()),
      'a compact RFC needs 3 to 4 sections (has 2)',
    );
    // RFC 903 is standard tier: 4 to 6 sections, and the compact example has 3.
    has(
      errorsFor(() => {}, 903),
      'a standard RFC needs 4 to 6 sections (has 3)',
    );
  });

  test('viz: lane keys, banned and unknown types, anchors, extra keys, tree depth', () => {
    const seq = {
      type: 'sequence',
      anchor: 'operation',
      caption: 'An exchange',
      data: {
        lanes: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ],
        messages: [{ from: 'a', to: 'c', label: 'x' }],
      },
    };
    has(
      errorsFor((o) => (o.viz = [seq])),
      'is not a lane key',
    );
    has(
      errorsFor((o) => (o.viz = [{ ...seq, type: 'sequence-sim' }])),
      '"sequence-sim" is not allowed',
    );
    has(
      errorsFor((o) => (o.viz = [{ ...seq, type: 'pie-chart' }])),
      'is not allowed; use one of',
    );
    has(
      errorsFor((o) => (o.viz[0].anchor = 'nowhere')),
      'is not one of your section ids',
    );
    has(
      errorsFor((o) => (o.viz[0].data.extra = true)),
      'unexpected key "extra"',
    );
    has(
      errorsFor((o) => (o.viz[0].data.fields[0].bits = 0)),
      'bits must be a positive whole number',
    );
    has(
      errorsFor((o) => (o.viz = [o.viz[0], o.viz[0]])),
      'at most 1 viz',
    );
    const deep = {
      label: '1',
      children: [{ label: '2', children: [{ label: '3', children: [{ label: '4', children: [{ label: '5' }] }] }] }],
    };
    has(
      errorsFor((o) => (o.viz = [{ type: 'tree', anchor: 'operation', caption: 'A tree', data: { root: deep } }]), 768),
      'deeper than 4 levels',
    );
    const ok = { label: '1', children: [{ label: '2', children: [{ label: '3', children: [{ label: '4' }] }] }] };
    expect(errorsFor((o) => (o.viz = [{ type: 'tree', anchor: 'operation', caption: 'A tree', data: { root: ok } }]))).toEqual([]);
  });

  test('bad HTML is rejected by the sanitizer', () => {
    has(
      errorsFor((o) => (o.sections[0].content += '<script>alert(1)</script>')),
      'unsafe HTML',
    );
    has(
      errorsFor((o) => (o.sections[0].content += "<p onclick='x()'>y</p>")),
      'unsafe HTML',
    );
    has(
      errorsFor((o) => (o.today = "<p><img src='x'></p> today text that is long enough")),
      'unsafe HTML',
    );
  });

  test('markdown and plain-text fields', () => {
    has(
      errorsFor(
        (o) =>
          (o.sections[0].content = '<p>This has **bold** markdown in it and is long enough to pass the minimum length check easily.</p>'),
      ),
      'Markdown',
    );
    has(
      errorsFor((o) => (o.subtitle = '<b>Bold</b> subtitle that is long enough')),
      'plain text',
    );
    has(
      errorsFor((o) => (o.questions[0] = 'What is UDP?')),
      'must not contain "?"',
    );
  });

  test('links and references must point at issued RFCs', () => {
    has(
      errorsFor((o) => (o.sections[0].content += "<p><a href='/rfc4242'>RFC 4242</a></p>")),
      'is not an issued RFC',
    );
    has(
      errorsFor((o) => (o.sections[0].content += "<p><a href='/rfc0768'>x</a></p>")),
      'zero-padded',
    );
    has(
      errorsFor((o) => (o.sections[0].content += "<p><a href='https://example.com/'>x</a></p>")),
      'not allowed',
    );
    has(
      errorsFor((o) => (o.sections[0].content += '<p>See RFC 0768.</p>')),
      'zero-padded',
    );
    has(
      errorsFor((o) => (o.sections[0].content += '<p>See RFC 123456.</p>')),
      'beyond the newest RFC',
    );
    has(
      errorsFor((o) => (o.references[0].rfc = 4242)),
      'is not an issued RFC number',
    );
    has(
      errorsFor((o) => (o.references[0].rfc = '0760')),
      'is not an issued RFC number',
    );
    expect(errorsFor((o) => (o.sections[0].content += "<p><a href='/rfc900'>RFC 900</a></p>"))).toEqual([]);
  });

  test('glossary: too many new terms, unknown ids, existing ids, id format', () => {
    const term = (i: number) => ({
      id: `new-term-${i}`,
      term: `T${i}`,
      definition: '<p>A definition that is long enough to pass.</p>',
      plainLanguage: 'Simple words.',
    });
    has(
      errorsFor((o) => {
        o.glossaryTerms = [1, 2, 3, 4, 5, 6].map(term);
        o.glossary = [...o.glossary, ...o.glossaryTerms.map((t: { id: string }) => t.id)].slice(-12);
      }),
      'at most 5 new terms',
    );
    has(
      errorsFor((o) => o.glossary.push('no-such-term')),
      'unknown id "no-such-term"',
    );
    has(
      errorsFor((o) => (o.glossaryTerms[0].id = 'udp')),
      '"udp" already exists',
    );
    has(
      errorsFor((o) => (o.glossaryTerms[0].id = 'Not_Kebab')),
      'kebab-case',
    );
    has(
      errorsFor((o) => (o.glossary = o.glossary.filter((g: string) => g !== 'demultiplexing'))),
      'not listed in glossary',
    );
    has(
      errorsFor((o) => (o.glossaryTerms[0].definition = '<p>Short.</p>')),
      'outside 30 to 700',
    );
  });

  test('re-validating after the glossary merge still passes (the term now lists this RFC)', () => {
    fx.writeGlossary('demultiplexing', { rfcs: [768] });
    env.glossaryIds.add('demultiplexing');
    try {
      expect(validateOutput(768, validOutput(), env)).toEqual([]);
      fx.writeGlossary('demultiplexing', { rfcs: [900] });
      has(validateOutput(768, validOutput(), env), '"demultiplexing" already exists');
    } finally {
      fs.rmSync(`${fx.paths.glossaryContentDir}/demultiplexing.json`);
      env.glossaryIds.delete('demultiplexing');
    }
  });

  test('files: missing, bad JSON, non-issued RFC', () => {
    expect(validateFile(768, env)[0]).toContain('does not exist');
    fs.writeFileSync(`${fx.paths.outDir}/768.json`, '{nope');
    expect(validateFile(768, env)[0]).toContain('invalid JSON');
    fx.writeOut(768, validOutput());
    expect(validateFile(768, env)).toEqual([]);
    expect(validateOutput(31337, validOutput(), env)[0]).toContain('not an issued RFC');
    expect(validateOutput(768, [], env)[0]).toContain('one JSON object');
    fs.rmSync(`${fx.paths.outDir}/768.json`);
  });
});
