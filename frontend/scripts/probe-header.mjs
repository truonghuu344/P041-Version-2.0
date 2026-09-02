/**
 * Drives headless Chrome over scripts/header-probe.html at each app breakpoint and
 * prints a pass/fail table for the shared-header contract:
 *   >=1200px → desktop nav visible, hamburger hidden
 *   <1200px  → desktop nav hidden, hamburger visible
 *   always   → bell + avatar visible, nav never wraps, no link pushed out of view
 *
 * Usage: node scripts/probe-header.mjs [width...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge binary found.');
  process.exit(1);
}

const PROBE = pathToFileURL(resolve(import.meta.dirname, 'header-probe.html')).href;
const widths = (process.argv.slice(2).length ? process.argv.slice(2) : [1440, 1366, 1200, 1024, 768, 430]).map(Number);

function probe(width) {
  const dom = execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--window-size=${width},900`,
      '--virtual-time-budget=4000',
      '--dump-dom',
      PROBE,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  const m = dom.match(/PROBE_JSON:(\{[\s\S]*?\})<\/pre>/);
  if (!m) throw new Error(`no probe output at ${width}px`);
  return JSON.parse(m[1]);
}

let failures = 0;
for (const width of widths) {
  const r = probe(width);
  const desktop = r.innerWidth >= 1200;
  const checks = [
    [desktop ? 'desktop nav VISIBLE' : 'desktop nav HIDDEN', r.navVisible === desktop],
    [desktop ? 'hamburger HIDDEN' : 'hamburger VISIBLE', r.hamVisible === !desktop],
    ['never both at once', !r.bothVisible],
    ['never neither', !r.neitherVisible],
    ['bell visible', r.targets.find((t) => t.label === 'bell')?.display !== 'none'],
    ['avatar visible', r.targets.find((t) => t.label === 'avatar')?.display !== 'none'],
  ];
  if (desktop) {
    checks.push(
      ['nav on ONE row', r.navRowCount === 1],
      ['no link pushed out of view', r.links.every((l) => !l.lost)],
      ['nav not clipped', !r.targets.find((t) => t.label === '#nav-links').clipped],
      ['all 6 links present', r.links.length === 6],
    );
  }
  const bad = checks.filter(([, ok]) => !ok);
  failures += bad.length;
  console.log(
    `\n${width}px (viewport ${r.innerWidth})  ${bad.length ? 'FAIL' : 'PASS'}  nav=${r.navVisible ? 'shown' : 'hidden'} hamburger=${r.hamVisible ? 'shown' : 'hidden'}`,
  );
  for (const [name, ok] of checks) console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (desktop) {
    console.log(
      `   links: ${r.links.map((l) => `${l.text}[${l.x}..${l.right}]`).join(' ')}`,
    );
    const nav = r.targets.find((t) => t.label === '#nav-links');
    console.log(`   #nav-links rect=${JSON.stringify(nav.rect)} scrollW=${nav.scrollW} clientW=${nav.clientW} gap=${nav.gap} color=${nav.color}`);
  }
  if (r.bodyHasHScroll) console.log('   NOTE: document has horizontal overflow');
}

console.log(`\n${failures ? `${failures} failing check(s)` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
