import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const windowStart = Date.now() - 24 * 60 * 60 * 1000;
const repoCwd = resolve(process.cwd()).toLowerCase();
const logDir = process.env.AI_LOG_DIR || '.ai-log';
const statePath = join(logDir, 'codex-state.json');

function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}

function findTranscripts(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findTranscripts(path) : entry.name.endsWith('.jsonl') ? [path] : [];
  });
}

let seen = new Set();
try { seen = new Set(JSON.parse(readFileSync(statePath, 'utf8'))); } catch { /* first run */ }

const origin = git(['remote', 'get-url', 'origin']);
const base = {
  tool: 'codex', event: 'UserPrompt',
  repo: origin.replace(/\/$/, '').split('/').pop()?.replace(/\.git$/, '') || '',
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  commit: git(['rev-parse', '--short', 'HEAD']),
  student: git(['config', 'user.email']),
};
const entries = [];

for (const transcript of findTranscripts(join(homedir(), '.codex', 'sessions'))) {
  let lines;
  try { lines = readFileSync(transcript, 'utf8').trim().split(/\r?\n/); } catch { continue; }
  let metadata;
  try { metadata = JSON.parse(lines[0]).payload || {}; } catch { continue; }
  if (resolve(metadata.cwd || '.').toLowerCase() !== repoCwd) continue;
  const sessionId = String(metadata.session_id || metadata.id || transcript);
  let turnId = '';
  for (const line of lines.slice(1)) {
    let item;
    try { item = JSON.parse(line); } catch { continue; }
    const payload = item.payload || {};
    if (item.type !== 'event_msg') continue;
    if (payload.type === 'task_started') { turnId = String(payload.turn_id || ''); continue; }
    if (payload.type !== 'user_message') continue;
    const timestamp = Date.parse(item.timestamp);
    const prompt = String(payload.message || '').trim();
    const entryId = `codex-${sessionId}-${turnId || item.timestamp}`;
    if (!prompt || !Number.isFinite(timestamp) || timestamp < windowStart || seen.has(entryId)) continue;
    entries.push({ ...base, ts: new Date(timestamp).toISOString(), entry_id: entryId, session_id: sessionId, turn_id: turnId, model: metadata.model_provider || 'codex', prompt: prompt.slice(0, 1000), response_summary: '' });
    seen.add(entryId);
  }
}

if (!entries.length) {
  console.error('[codex-log] No new prompts for this repository.');
  process.exit(0);
}
mkdirSync(logDir, { recursive: true });
entries.sort((a, b) => a.ts.localeCompare(b.ts));
appendFileSync(join(logDir, 'session.jsonl'), `${entries.map(JSON.stringify).join('\n')}\n`, 'utf8');
writeFileSync(statePath, JSON.stringify([...seen].sort()), 'utf8');
console.error(`[codex-log] Recorded ${entries.length} prompt(s).`);
