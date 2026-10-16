import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { finalizeGlossary, isComplete, pickDefinition } from '../../scripts/explain/glossary-finalize';
import { type Fixture, makeFixture } from './helpers';

let fx: Fixture;
beforeEach(() => {
  fx = makeFixture();
});
afterEach(() => fx.cleanup());

const work = (n: number, terms: unknown[]) => fs.writeFileSync(path.join(fx.paths.glossaryWorkDir, `${n}.json`), JSON.stringify(terms));
const term = (id: string, definition: string, eli5 = 'Simple.') => ({ id, term: id.toUpperCase(), definition, eli5 });
const glossaryFile = (id: string) => path.join(fx.paths.glossaryContentDir, `${id}.json`);

describe('definition choice', () => {
  test('complete means a full sentence', () => {
    expect(isComplete('<p>A thing that works.</p>')).toBe(true);
    expect(isComplete('<p>A thing that works and')).toBe(false);
  });
  test('shortest complete, else shortest', () => {
    const d = (n: number, definition: string) => ({ n, id: 'x', term: 'X', definition });
    expect(
      pickDefinition([d(1, '<p>Cut off mid'), d(2, '<p>Long but complete definition here.</p>'), d(3, '<p>Short complete one.</p>')]).n,
    ).toBe(3);
    expect(pickDefinition([d(1, '<p>Cut off mid'), d(2, '<p>Cut off mid sentence too')]).n).toBe(1);
  });
});

describe('finalize', () => {
  test('dedupes, drops singletons, keeps existing, rewrites glossary arrays', () => {
    // 900 and 901 both define "framing"; 900 alone defines "lonely"; "udp" exists already.
    work(900, [
      term('framing', '<p>A very long and winding definition of framing that goes on.</p>'),
      term('lonely', '<p>Only one RFC defines this term.</p>'),
    ]);
    work(901, [term('framing', '<p>Marking where messages begin and end.</p>'), term('udp', '<p>Replacement that must not win.</p>')]);
    fx.writeContent(900, { ...fx.readContent(900), glossary: ['framing', 'lonely', 'udp'] });
    fx.writeContent(901, { ...fx.readContent(901), glossary: ['framing', 'udp', 'port-number'] });
    const before = fs.readFileSync(glossaryFile('udp'), 'utf8');

    const r = finalizeGlossary({ paths: fx.paths });
    expect(r.created).toBe(1);
    expect(r.dropped).toEqual(['lonely']);
    expect(r.deduped).toEqual(['framing']);
    expect(r.rewritten).toEqual([900]);

    const framing = JSON.parse(fs.readFileSync(glossaryFile('framing'), 'utf8'));
    expect(framing.definition).toBe('<p>Marking where messages begin and end.</p>');
    expect(framing.rfcs).toEqual([900, 901]);
    expect(fs.existsSync(glossaryFile('lonely'))).toBe(false);
    // existing definition preserved; only its rfcs list grew
    const udp = JSON.parse(fs.readFileSync(glossaryFile('udp'), 'utf8'));
    expect(udp.definition).toBe('<p>Definition of udp.</p>');
    expect(udp.rfcs).toEqual([1, 901]);
    expect(before).not.toBe(fs.readFileSync(glossaryFile('udp'), 'utf8'));

    expect(fx.readContent(900).glossary).toEqual(['framing', 'udp']);
    expect(fx.readContent(901).glossary).toEqual(['framing', 'udp', 'port-number']);
  });

  test('is idempotent', () => {
    work(900, [term('framing', '<p>Marking where messages begin and end.</p>')]);
    work(901, [term('framing', '<p>Marking where messages begin and end.</p>')]);
    finalizeGlossary({ paths: fx.paths });
    const snapshot = fs.readFileSync(glossaryFile('framing'), 'utf8');
    const second = finalizeGlossary({ paths: fx.paths });
    expect(second.created).toBe(0);
    expect(second.rewritten).toEqual([]);
    expect(fs.readFileSync(glossaryFile('framing'), 'utf8')).toBe(snapshot);
  });

  test('unsafe definitions are rejected and removed from RFC glossary arrays', () => {
    work(900, [term('evil', '<script>alert(1)</script>')]);
    work(901, [term('evil', '<script>alert(1)</script>')]);
    fx.writeContent(900, { ...fx.readContent(900), glossary: ['evil'] });
    const r = finalizeGlossary({ paths: fx.paths });
    expect(r.rejected).toHaveLength(1);
    expect(fs.existsSync(glossaryFile('evil'))).toBe(false);
    expect(fx.readContent(900).glossary).toEqual([]);
  });

  test('dry run writes nothing', () => {
    work(900, [term('framing', '<p>Marking where messages begin and end.</p>')]);
    work(901, [term('framing', '<p>Marking where messages begin and end.</p>')]);
    const r = finalizeGlossary({ paths: fx.paths, dryRun: true });
    expect(r.created).toBe(1);
    expect(fs.existsSync(glossaryFile('framing'))).toBe(false);
  });
});
