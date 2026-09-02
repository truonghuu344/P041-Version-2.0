/**
 * Cascade audit for the shared app header.
 *
 * Rebuilds the exact stylesheet order the browser sees (globals.css @import chain),
 * then for a synthetic AppHeader DOM reports every `display` declaration that
 * matches #nav-links / #hamburger at a given viewport width, ranked by the real
 * cascade (importance → specificity → source order).
 *
 * Usage: node scripts/audit-header-cascade.mjs [width...]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');
// jsdom ships as a transitive dep of jest-environment-jsdom — resolve from the
// frontend package root so this script works no matter where node is invoked.
const { JSDOM } = createRequire(resolve(ROOT, 'package.json'))('jsdom');
const ENTRY = resolve(ROOT, 'app/globals.css');

/* ── 1. Resolve the @import chain into an ordered list of [file, css] ── */
function loadOrdered(file, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const css = readFileSync(file, 'utf8');
  const out = [];
  const importRe = /@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)\s*;/g;
  let last = 0;
  let m;
  while ((m = importRe.exec(css))) {
    const head = css.slice(last, m.index);
    if (head.trim()) out.push([file, head]);
    out.push(...loadOrdered(resolve(dirname(file), m[1]), seen));
    last = importRe.lastIndex;
  }
  const tail = css.slice(last);
  if (tail.trim()) out.push([file, tail]);
  return out;
}

/* ── 2. Flatten into rules, carrying the @media condition ── */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractRules(file, css) {
  const rules = [];
  const src = stripComments(css);
  // Walk brace-balanced blocks so @media contents are captured whole.
  let i = 0;
  const walk = (text, offset, media) => {
    let pos = 0;
    while (pos < text.length) {
      const open = text.indexOf('{', pos);
      if (open === -1) break;
      const prelude = text.slice(pos, open).trim();
      // find matching close brace
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (/^@media/i.test(prelude)) {
        walk(body, offset + open + 1, media ? `${media} AND ${prelude}` : prelude);
      } else if (prelude.startsWith('@')) {
        // @keyframes / @supports / @font-face — irrelevant for display of our nodes
      } else if (prelude) {
        rules.push({ file, media, selector: prelude, body, order: i++ });
      }
      pos = j;
    }
  };
  walk(src, 0, null);
  return rules;
}

/* ── 3. Media query evaluation (width-only, which is all this app uses) ── */
function mediaMatches(media, width) {
  if (!media) return true;
  for (const part of media.split(/\s+AND\s+/)) {
    const conds = [...part.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const hasWidthCond = conds.length > 0;
    for (const [, kind, px] of conds) {
      const v = parseFloat(px);
      if (kind === 'min' && !(width >= v)) return false;
      if (kind === 'max' && !(width <= v)) return false;
    }
    // Non-width queries (prefers-reduced-motion etc.) are treated as non-matching
    // unless they also carry a width condition we already validated.
    if (!hasWidthCond && /\(/.test(part)) return false;
  }
  return true;
}

/* ── 4. Specificity ── */
function specificity(sel) {
  let s = sel.trim();
  // :not(...) / :is(...) / :has(...) contribute their argument's specificity.
  const inner = [];
  s = s.replace(/:(?:not|is|has)\(([^()]*)\)/g, (_, arg) => {
    inner.push(arg);
    return '';
  });
  s = s.replace(/::[\w-]+/g, ''); // pseudo-elements → type-level, ignore for our purpose
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes =
    (s.match(/\.[\w-]+/g) || []).length +
    (s.match(/\[[^\]]+\]/g) || []).length +
    (s.match(/:[\w-]+(?!\()/g) || []).length;
  const types = (s.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
  let acc = [ids, classes, types];
  for (const arg of inner) {
    const a = specificity(arg);
    acc = [acc[0] + a[0], acc[1] + a[1], acc[2] + a[2]];
  }
  return acc;
}

const cmpSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/* ── 5. Synthetic AppHeader DOM (mirrors components/shared/AppHeader.tsx) ── */
const dom = new JSDOM(`<!doctype html><html><body class="role-student">
<header class="navbar app-header-root" id="navbar">
  <div class="navbar-inner">
    <a href="#" class="brand" id="brand-logo"><span class="brand-icon"></span><span class="brand-name">Career Assistant</span></a>
    <nav class="nav-links" id="nav-links" aria-label="Dieu huong chinh">
      <a href="#" class="nav-link active" id="nav-dashboard"><span class="nav-text">Trang chu</span></a>
      <a href="#" class="nav-link" id="nav-match"><span class="nav-text">So khop CV</span></a>
      <a href="#" class="nav-link" id="nav-interview"><span class="nav-text">Phong van</span></a>
      <a href="#" class="nav-link" id="nav-cv"><span class="nav-text">CV cua toi</span></a>
      <a href="#" class="nav-link" id="nav-find-jobs"><span class="nav-text">Viec lam</span></a>
      <a href="#" class="nav-link" id="nav-history"><span class="nav-text">Lich su</span></a>
    </nav>
    <div class="header-utilities flex items-center gap-2">
      <div id="header-notification-container" class="flex items-center justify-center"></div>
      <div class="flex items-center justify-center"></div>
      <button type="button" class="hamburger" id="hamburger" aria-label="Mo menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header></body></html>`);
const doc = dom.window.document;

const TARGETS = {
  'header#navbar': doc.getElementById('navbar'),
  '.navbar-inner': doc.querySelector('.navbar-inner'),
  '#nav-links': doc.getElementById('nav-links'),
  '#nav-history (last nav-link)': doc.getElementById('nav-history'),
  '.nav-text': doc.querySelector('#nav-history .nav-text'),
  '.header-utilities': doc.querySelector('.header-utilities'),
  '#hamburger': doc.getElementById('hamburger'),
};

/* ── 6. Collect all rules ── */
const ordered = loadOrdered(ENTRY);
const allRules = [];
let globalOrder = 0;
for (const [file, css] of ordered) {
  for (const r of extractRules(file.replace(ROOT + '\\', '').replace(ROOT + '/', ''), css)) {
    allRules.push({ ...r, order: globalOrder++ });
  }
}
console.log(`Parsed ${allRules.length} rules from ${new Set(ordered.map((o) => o[0])).size} files\n`);

const PROPS = [
  'display',
  'visibility',
  'opacity',
  'overflow',
  'overflow-x',
  'position',
  'transform',
  'width',
  'max-width',
  'min-width',
  'flex',
  'flex-wrap',
  'height',
  'color',
  'background',
  'font-size',
  'gap',
  'padding',
  'padding-inline',
  'z-index',
  'clip-path',
];

function declsFor(body, prop) {
  const out = [];
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;}]+)`, 'gi');
  let m;
  while ((m = re.exec(body))) {
    const raw = m[1].trim();
    out.push({ value: raw.replace(/\s*!important$/i, '').trim(), important: /!important/i.test(raw) });
  }
  return out;
}

const widths = (process.argv.slice(2).length ? process.argv.slice(2) : [1440, 1366, 1200, 1024, 768, 430]).map(
  Number,
);

for (const width of widths) {
  console.log(`${'='.repeat(72)}\nVIEWPORT ${width}px\n${'='.repeat(72)}`);
  for (const [label, el] of Object.entries(TARGETS)) {
    for (const prop of PROPS) {
      const hits = [];
      for (const r of allRules) {
        if (!mediaMatches(r.media, width)) continue;
        const decls = declsFor(r.body, prop);
        if (!decls.length) continue;
        for (const sel of r.selector.split(',')) {
          const s = sel.trim();
          if (!s) continue;
          let matched = false;
          try {
            matched = el.matches(s);
          } catch {
            /* unsupported selector → skip */
          }
          if (!matched) continue;
          for (const d of decls) {
            hits.push({ ...d, selector: s, file: r.file, media: r.media, order: r.order, spec: specificity(s) });
          }
        }
      }
      if (!hits.length) continue;
      hits.sort(
        (a, b) => a.important - b.important || cmpSpec(a.spec, b.spec) || a.order - b.order,
      );
      const winner = hits[hits.length - 1];
      console.log(`\n  ${label} → ${prop}: ${winner.value}${winner.important ? ' !important' : ''}`);
      console.log(`     WINNER  ${winner.file}  {${winner.selector}}  spec=${winner.spec.join(',')}${winner.media ? `  @${winner.media}` : ''}`);
      if (hits.length > 1) {
        console.log(`     ${hits.length - 1} losing declaration(s):`);
        for (const h of hits.slice(0, -1).reverse()) {
          console.log(
            `       - ${h.value}${h.important ? ' !important' : ''}  ${h.file} {${h.selector}} spec=${h.spec.join(',')}${h.media ? ` @${h.media}` : ''}`,
          );
        }
      }
    }
  }
  console.log('');
}
