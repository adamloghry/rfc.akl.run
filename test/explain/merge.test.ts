import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PROMPT_VERSION, SCHEMA_VERSION } from '../../scripts/explain/lib';
import { mergeOutputs } from '../../scripts/explain/merge';
import { loadEnv } from '../../scripts/explain/validate';
import { rfcSchema } from '../../src/lib/schemas';
import { type Fixture, makeFixture, validOutput } from './helpers';

let fx: Fixture;
beforeEach(() => {
  fx = makeFixture();
});
afterEach(() => fx.cleanup());
const run = (numbers?: number[]) => mergeOutputs({ paths: fx.paths, env: loadEnv(fx.paths, fx.summary), date: '2026-10-20', numbers });

describe('merge', () => {
  test('merges a valid output, preserves fields, sets provenance, moves glossary terms', () => {
    fx.writeContent(768, {
      ...fx.readContent(768),
      shortTitle: 'UDP',
      category: 'transport',
      questions: ['what is udp', 'q2', 'q3', 'q4', 'q5'],
    });
    fx.writeOut(768, { ...validOutput(), shortTitle: 'Other' });
    const r = run();
    expect(r.merged).toEqual([768]);
    expect(r.invalid).toEqual([]);

    const c = fx.readContent(768);
    expect(rfcSchema.safeParse(c).success).toBe(true);
    expect(c.summary).toBe('<p>Summary of RFC 768.</p>');
    expect(c.plainLanguage.summary).toBe(validOutput().plainLanguage.summary); // the generated one replaces the existing one
    expect(c.category).toBe('transport');
    expect(c.shortTitle).toBe('UDP');
    // existing questions first, generated ones appended, deduped, max 6
    expect(c.questions).toHaveLength(6);
    expect(c.questions.slice(0, 5)).toEqual(['what is udp', 'q2', 'q3', 'q4', 'q5']);
    expect(c.sections).toHaveLength(3);
    expect(c.glossary).toContain('demultiplexing');
    expect(c.glossaryTerms).toBeUndefined();
    expect(c.provenance).toEqual({
      source: 'llm-draft',
      model: 'claude-sonnet-5-5',
      drafted: '2026-10-20',
      reviewedBy: null,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
    });
    expect(c.updated).toBe('2026-10-20');

    const g = JSON.parse(fs.readFileSync(path.join(fx.paths.glossaryWorkDir, '768.json'), 'utf8'));
    expect(g).toHaveLength(1);
    expect(g[0].id).toBe('demultiplexing');
  });

  test('shortTitle is taken from the output only when the file has none', () => {
    fx.writeOut(900, { ...validOutput(), shortTitle: 'Nine Hundred' });
    run();
    expect(fx.readContent(900).shortTitle).toBe('Nine Hundred');
  });

  test('skips content files that already have sections, byte for byte', () => {
    const existing = { ...fx.readContent(768), sections: [{ id: 'introduction', title: 'Intro', content: '<p>Hand written.</p>' }] };
    fx.writeContent(768, existing);
    const before = fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8');
    fx.writeOut(768, validOutput());
    const r = run();
    expect(r.skippedExisting).toEqual([768]);
    expect(r.merged).toEqual([]);
    expect(fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(fx.paths.glossaryWorkDir, '768.json'))).toBe(false);
  });

  test('replaces an explainer from an older prompt version; skips one from the current version', () => {
    const stale = {
      ...fx.readContent(768),
      sections: [{ id: 'introduction', title: 'Intro', content: '<p>Old.</p>' }],
      provenance: { source: 'llm-draft', promptVersion: 'explain-v1' },
    };
    fx.writeContent(768, stale);
    fx.writeOut(768, validOutput());
    expect(run().merged).toEqual([768]);
    expect(fx.readContent(768).provenance.promptVersion).toBe(PROMPT_VERSION);
    fx.writeOut(768, { ...validOutput(), subtitle: 'Changed' });
    expect(run().skippedExisting).toEqual([768]);
    expect(fx.readContent(768).subtitle).not.toBe('Changed');
  });

  test('is idempotent', () => {
    fx.writeOut(768, validOutput());
    expect(run().merged).toEqual([768]);
    const after = fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8');
    const second = run();
    expect(second.merged).toEqual([]);
    expect(second.skippedExisting).toEqual([768]);
    expect(fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8')).toBe(after);
    expect(fs.readdirSync(fx.paths.contentDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  test('invalid and unreadable outputs leave content untouched', () => {
    const before = fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8');
    fx.writeOut(768, { ...validOutput(), provenance: { source: 'human' } });
    fs.writeFileSync(path.join(fx.paths.outDir, '900.json'), '{broken');
    const r = run();
    expect(r.merged).toEqual([]);
    expect(r.invalid.map((x) => x.number)).toEqual([768]);
    expect(r.unreadable.map((x) => x.number)).toEqual([900]);
    expect(fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8')).toBe(before);
  });

  test('dry run changes nothing', () => {
    fx.writeOut(768, validOutput());
    const before = fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8');
    const r = mergeOutputs({ paths: fx.paths, env: loadEnv(fx.paths, fx.summary), dryRun: true });
    expect(r.merged).toEqual([768]);
    expect(fs.readFileSync(path.join(fx.paths.contentDir, '768.json'), 'utf8')).toBe(before);
  });
});
