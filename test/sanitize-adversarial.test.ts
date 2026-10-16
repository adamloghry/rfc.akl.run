// Adversarial corpus for the HTML allowlist (src/lib/sanitize-check.ts). The original REJECT/ACCEPT tables
// live in lint.test.ts and stay there; these cases add scheme smuggling, parser-differential tricks and
// resource-exhaustion shapes. Every REJECT entry is markup a browser would act on.
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { checkContent, checkHtml, HTML_FIELDS, walkStrings } from '../src/lib/sanitize-check';

const a = (href: string) => `<a href="${href}">x</a>`;
const rejects = (cases: string[]) => {
  for (const html of cases) assert.ok(checkHtml(html).length > 0, `should be rejected: ${JSON.stringify(html)}`);
};
const accepts = (cases: string[]) => {
  for (const html of cases) assert.deepEqual(checkHtml(html), [], `should be accepted: ${JSON.stringify(html)}`);
};

describe('URL scheme smuggling in href', () => {
  test('case, whitespace and control characters inside or before the scheme', () => {
    rejects([
      a('JaVaScRiPt:alert(1)'),
      a('java\tscript:alert(1)'),
      a('java\nscript:alert(1)'),
      a('java\rscript:alert(1)'),
      a('\u0001javascript:alert(1)'),
      a('\u0000javascript:alert(1)'),
      a(' javascript:alert(1)'),
      a('​javascript:alert(1)'),
      a('‏javascript:alert(1)'),
      a(' javascript:alert(1)'),
      a(' javascript:alert(1)'),
      a('﻿javascript:alert(1)'),
      a('\u007fjavascript:alert(1)'),
      a('  \t javascript:alert(1)'),
      a('j​avascript:alert(1)'),
    ]);
  });

  test('numeric and named character references, with or without the semicolon', () => {
    rejects([
      a('&#106;avascript:alert(1)'),
      a('&#106avascript:alert(1)'),
      a('&#x6a;avascript:alert(1)'),
      a('&#X6A;avascript:alert(1)'),
      a('&#0000106;avascript:alert(1)'),
      a('&#x00006a;avascript:alert(1)'),
      a('javascript&colon;alert(1)'),
      a('javascript&#58;alert(1)'),
      a('javascript&#x3a;alert(1)'),
      a('javascript&Tab;:alert(1)'),
      a('javascript&NewLine;:alert(1)'),
      a('&#14;javascript:alert(1)'),
      a('&#x1;javascript:alert(1)'),
    ]);
  });

  test('entities that decode into a protocol-relative or backslash host', () => {
    rejects([
      a('&#47;&#47;evil.example'),
      a('/&#47;evil.example'),
      a('&sol;&sol;evil.example'),
      a('/&bsol;evil.example'),
      a('/&#92;evil.example'),
      a('&#x2f;/evil.example'),
    ]);
  });

  test('repeated encoding is decoded to a fixed point', () => {
    rejects([a('&amp;#106;avascript:alert(1)'), a('&amp;amp;#106;avascript:alert(1)'), a('&amp;amp;amp;#106;avascript:alert(1)')]);
  });

  test('other schemes and relative forms that are not on the allowlist', () => {
    rejects([
      a('vbscript:msgbox(1)'),
      a('data:text/html;base64,PHNjcmlwdD4='),
      a('file:///etc/passwd'),
      a('ftp://example.org/x'),
      a('blob:https://example.org/uuid'),
      a('tel:+15551234'),
      a('about:blank'),
      a('chrome://settings'),
      a('x.html'),
      a('./x'),
      a('../x'),
      a('?q=1'),
      a(''),
      a('   '),
      a('//evil.example/x'),
      a('/\\evil.example'),
      a('\\\\evil.example\\x'),
      a('httpx://example.org'),
      a('https//example.org'),
      a('xhttps://example.org'),
    ]);
  });

  test('href without a value or with an unquoted hostile value', () => {
    rejects([
      '<a href>x</a>',
      '<a href=javascript:alert(1)>x</a>',
      '<a href=//evil.example>x</a>',
      '<a href="javascript:alert(1)" href="/ok">x</a>',
      '<a href="/ok" href="javascript:alert(1)">x</a>',
      '<a HREF="javascript:alert(1)">x</a>',
    ]);
  });

  test('allowed targets', () => {
    accepts([
      a('https://example.org/a?b=1&c=2#frag'),
      a('HTTPS://EXAMPLE.ORG'),
      a('http://example.org'),
      a('mailto:me@example.org'),
      a('MAILTO:me@example.org'),
      a('/'),
      a('/903/'),
      a('/a/b/?q=1#x'),
      a('#section-2'),
      a('#'),
      a('&#47;903&#47;'), // decodes to /903/
      a('/path&amp;more'),
    ]);
  });
});

describe('tags and attributes', () => {
  test('script-capable and embedding elements', () => {
    rejects([
      '<script>',
      '<SCRIPT >x</SCRIPT>',
      '<script/src=//evil.example>',
      '<script\tsrc=x>',
      '<svg><script>alert(1)</script></svg>',
      '<svg onload=alert(1)>',
      '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
      '<object data="x"></object>',
      '<embed src="x">',
      '<iframe srcdoc="<p>x</p>"></iframe>',
      '<link rel=stylesheet href=//evil.example/x.css>',
      '<style>@import "//evil.example";</style>',
      '<meta charset="x">',
      '<base href="//evil.example/">',
      '<form action="/x"><input name=a></form>',
      '<button formaction="javascript:alert(1)">x</button>',
      '<textarea>x</textarea>',
      '<select><option>x</option></select>',
      '<template><script>x</script></template>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<xmp><script>x</script></xmp>',
      '<plaintext>',
      '<details open ontoggle=alert(1)>x</details>',
      '<video src=x onerror=alert(1)>',
      '<audio src=x onerror=alert(1)>',
      '<img src=x>',
      '<marquee onstart=alert(1)>',
      '<isindex>',
      '<title>x</title>',
    ]);
  });

  test('attributes: handlers, style, namespaced and data-*', () => {
    rejects([
      '<p onclick="x">a</p>',
      '<p ONCLICK="x">a</p>',
      '<p onmouseover=x>a</p>',
      '<p style="background:url(javascript:x)">a</p>',
      '<p srcdoc="x">a</p>',
      '<p formaction="x">a</p>',
      '<p xlink:href="x">a</p>',
      '<p data-x="1">a</p>',
      '<p contenteditable>a</p>',
      '<p tabindex=0>a</p>',
      '<p is="x-evil">a</p>',
      '<a href="/x" target=_blank>a</a>',
      '<a href="/x" rel=opener>a</a>',
      '<a href="/x" ping="//evil.example">a</a>',
      '<a href="/x" download>a</a>',
    ]);
  });

  test('tag names are matched case-insensitively and only against the allowlist', () => {
    rejects(['<P>ok</P><Script>x</Script>', '<DIV><IFRAME></IFRAME></DIV>', '<pp>x</pp>', '<p-x>x</p-x>', '<a-b>x</a-b>']);
    accepts(['<P CLASS="x">ok</P>', '<TABLE><TR><TD COLSPAN=2>x</TD></TR></TABLE>', '<Em>x</Em>']);
  });

  test('allowed attributes in odd spellings', () => {
    accepts([
      '<p class=a>x</p>',
      "<p class='a b' id='c' lang=en title=\"t\">x</p>",
      '<p\tclass="a"\n id="b">x</p>',
      '<p aria-label="y" aria-hidden=true>x</p>',
      '<td colspan=2 rowspan="3">x</td>',
      '<a title="a>b" href="/x">x</a>',
      '<p class="a"/>',
      '<br />',
      '<hr/>',
      '<p class="">x</p>',
    ]);
  });
});

describe('parser-differential and malformed markup', () => {
  test('tags that cannot be parsed cleanly are rejected, not guessed at', () => {
    rejects([
      '<scr<script>ipt>alert(1)</script>',
      '<a href="/x',
      "<a href='/x",
      '<p',
      '<p class=',
      '<p class="x"',
      '<a href=>x</a>',
      '<a href=`javascript:alert(1)`>x</a>',
      '<a href="/x"onclick="y">x</a>',
      "<a href='/x'onclick='y'>x</a>",
      '<p "x">',
      '<p =x>',
      '<p <b>x</p>',
      '<p<b>x</p>',
      '<a href="/x"/onclick=y>x</a>',
      '<img/src=x/onerror=y>',
    ]);
  });

  test('closing tags: unknown, with attributes, or malformed', () => {
    rejects(['</script>', '</SCRIPT >', '</iframe>', '</a href=x>', '</p x>', '</scr<ipt>', '</a\n/onclick=1>']);
    accepts(['</p>', '</P>', '</p  >', '</p\n>', '<p>x</p></p>']);
  });

  test('comments, CDATA, doctype and processing instructions are never allowed', () => {
    rejects([
      '<!-- x -->',
      '<!--',
      '<!-->',
      '<!--[if IE]><script>x</script><![endif]-->',
      '<![CDATA[x]]>',
      '<!DOCTYPE html>',
      '<!doctype html><p>x</p>',
      '<?xml version="1.0"?>',
      '<?php echo 1; ?>',
      '<!',
      '<?',
    ]);
  });

  test('null bytes and other junk inside tag names do not create an allowed tag', () => {
    rejects(['<scr\u0000ipt>x</scr\u0000ipt>', '<p\u0000onclick=x>', '<a\u0000href="/x">x</a>']);
    // "<" + NUL does not open a tag in browsers either, so this stays text.
    accepts(['<\u0000script>']);
  });

  test('a rejected tag is reported once however often it repeats', () => {
    const problems = checkHtml('<script></script><script></script><script></script>');
    assert.equal(new Set(problems).size, problems.length);
    assert.deepEqual(problems, ['tag not allowed: <script>', 'tag not allowed: </script>']);
  });

  test('every problem in a fragment is reported, not just the first', () => {
    const problems = checkHtml('<p onclick=x><script>y</script><a href="javascript:z">a</a>');
    assert.ok(problems.some((p) => p.startsWith('attribute not allowed: onclick')));
    assert.ok(problems.includes('tag not allowed: <script>'));
    assert.ok(problems.some((p) => p.startsWith('href not allowed')));
  });
});

describe('plain text is not markup', () => {
  test('a "<" that cannot start a tag is text, as browsers parse it', () => {
    accepts([
      'a < b',
      '1<2 and 3>2',
      'x <= y',
      '<3 hearts',
      '<-- arrow',
      '< p>',
      '<>',
      '<=>',
      'ends with <',
      '<<',
      '<<<<<<<<<<',
      '<1>',
      '<_x>',
      'a</ b>',
      '</ p>',
      '</1>',
      '</>',
      'AT&T and &lt;script&gt;',
      '<code>if (a&lt;b) { go(); }</code>',
    ]);
  });

  test('but "<" directly before a letter opens a tag in browsers, so code samples must escape it', () => {
    rejects(['<pre>if (a<b) { go(); }</pre>', '<p>x<y</p>', '<p>keys <From, To> range</p>']);
  });

  test('text containing quotes, backticks and non-ASCII', () => {
    accepts(['<p>"quoted" \'single\' `tick` — dash ünï 日本語</p>', '', ' ', '\n']);
  });

  test('non-string input is stringified rather than crashing', () => {
    assert.deepEqual(checkHtml(null), []);
    assert.deepEqual(checkHtml(undefined), []);
    assert.deepEqual(checkHtml(42), []);
    assert.deepEqual(checkHtml({}), []);
    assert.ok(checkHtml({ toString: () => '<script>' }).length > 0);
  });
});

describe('resource exhaustion', () => {
  const timed = (html: string, budgetMs = 1500) => {
    const t0 = performance.now();
    const out = checkHtml(html);
    const dt = performance.now() - t0;
    assert.ok(dt < budgetMs, `took ${Math.round(dt)} ms`);
    return out;
  };

  test('large plain text', () => assert.deepEqual(timed('lorem ipsum '.repeat(40_000)), []));
  test('long runs of "<"', () => assert.deepEqual(timed('<'.repeat(100_000)), []));
  test('deep nesting of allowed tags', () => assert.deepEqual(timed('<div>'.repeat(20_000) + '</div>'.repeat(20_000)), []));
  test('thousands of attributes on one tag', () => {
    const attrs = Array.from({ length: 3000 }, (_, i) => `title="v${i}"`).join(' ');
    assert.deepEqual(timed(`<p ${attrs}>x</p>`), []);
  });
  test('a huge attribute value', () => assert.deepEqual(timed(`<a href="/${'a'.repeat(200_000)}">x</a>`), []));
  test('many unterminated tags stop at the first malformed one', () => {
    const out = timed('<a href="/x'.repeat(5000));
    assert.equal(out.length, 1);
  });
  test('entity soup in an href', () => {
    const out = timed(a(`${'&amp;'.repeat(20_000)}#106;avascript:x`));
    assert.ok(out.length > 0);
  });
});

describe('checkContent and walkStrings', () => {
  test('only the fields that are rendered as HTML are checked', () => {
    const doc = {
      title: '<script>not rendered as html</script>',
      summary: '<script>x</script>',
      today: '<p onclick=x>t</p>',
      eli5: { summary: '<iframe></iframe>' },
      sections: [{ title: '<b>escaped</b>', content: '<p>ok</p>', eli5: '<style></style>' }, { content: '<img src=x>' }],
      references: [{ text: '<script>escaped on render</script>' }],
    };
    const out = checkContent(doc, 'rfc');
    assert.deepEqual(
      [...new Set(out.map((o) => o.ptr))].sort(),
      ['/eli5/summary', '/sections/0/eli5', '/sections/1/content', '/summary', '/today'].sort(),
    );
  });

  test('glossary checks the definition only; journeys check nothing; the default kind is rfc', () => {
    const g = { id: 'x', term: '<script>', definition: '<script>', eli5: '<script>' };
    assert.deepEqual(
      checkContent(g, 'glossary').map((o) => o.ptr),
      ['/definition'],
    );
    assert.deepEqual(checkContent({ title: '<script>', steps: [{ title: '<script>' }] }, 'journey'), []);
    assert.equal(checkContent({ summary: '<script>' }).length, 1);
  });

  test('clean content has no problems and non-object content is tolerated', () => {
    assert.deepEqual(checkContent({ summary: '<p>fine</p>', sections: [{ content: '<p>also fine</p>' }] }), []);
    for (const v of [null, undefined, 3, 'str', []]) assert.deepEqual(checkContent(v), []);
  });

  test('the field patterns are anchored', () => {
    assert.ok(HTML_FIELDS.rfc?.test('/sections/12/content'));
    assert.ok(!HTML_FIELDS.rfc?.test('/sections/12/content/extra'));
    assert.ok(!HTML_FIELDS.rfc?.test('/sections/x/content'));
    assert.ok(!HTML_FIELDS.rfc?.test('/x/summary'));
    assert.ok(!HTML_FIELDS.journey?.test('/title'));
    assert.ok(!HTML_FIELDS.journey?.test(''), 'journeys render every string escaped');
  });

  test('walkStrings reports JSON pointers for every string, through arrays and objects', () => {
    const seen: Array<[string, string]> = [];
    walkStrings({ a: 'x', b: ['y', { c: 'z' }], d: 5, e: null, f: [['w']] }, (s, ptr) => seen.push([ptr, s]));
    assert.deepEqual(seen, [
      ['/a', 'x'],
      ['/b/0', 'y'],
      ['/b/1/c', 'z'],
      ['/f/0/0', 'w'],
    ]);
    const root: string[] = [];
    walkStrings('top', (_s, ptr) => root.push(ptr));
    assert.deepEqual(root, ['']);
  });

  test('walkStrings skips the verbatim source of "code" viz but not other viz data', () => {
    const seen: string[] = [];
    walkStrings(
      {
        viz: [
          { type: 'code', caption: 'cap', data: { code: '<script>verbatim</script>' } },
          { type: 'packet', data: { fields: [{ name: 'n' }] } },
          null,
          'loose',
        ],
        other: { viz: 'not an array' },
      },
      (_s, ptr) => seen.push(ptr),
    );
    assert.deepEqual(seen, ['/viz/0/type', '/viz/0/caption', '/viz/1/type', '/viz/1/data/fields/0/name', '/viz/3', '/other/viz']);
  });
});
