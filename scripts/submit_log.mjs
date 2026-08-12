import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnv();
const server = process.env.AI_LOG_SERVER || '';
const apiKey = process.env.AI_LOG_API_KEY || '';
const logDir = process.env.AI_LOG_DIR || '.ai-log';
const logFile = join(logDir, 'session.jsonl');

function restore(pending) {
  if (!existsSync(pending)) return;
  if (existsSync(logFile)) {
    writeFileSync(logFile, Buffer.concat([readFileSync(pending), readFileSync(logFile)]));
    unlinkSync(pending);
  } else renameSync(pending, logFile);
}

async function main() {
  if (!server) return console.error('[ai-log] AI_LOG_SERVER not set — skipping submission.');
  if (!existsSync(logFile) || !readFileSync(logFile).length) return console.error('[ai-log] No logs to submit.');
  const pending = join(logDir, `session.pending.${Date.now()}.jsonl`);
  renameSync(logFile, pending);
  const entries = readFileSync(pending, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).slice(0, 500);
  if (!entries.length) { unlinkSync(pending); return console.error('[ai-log] No valid entries to submit.'); }
  try {
    const response = await fetch(server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ entries }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    mkdirSync(join(logDir, 'archive'), { recursive: true });
    appendFileSync(join(logDir, 'archive', `${new Date().toISOString().slice(0, 10)}.jsonl`), readFileSync(pending));
    unlinkSync(pending);
    console.error(`[ai-log] Submitted ${entries.length} entries → ${response.status}`);
  } catch (error) {
    restore(pending);
    console.error(`[ai-log] Submit failed: ${error.message} — logs kept locally.`);
  }
}

await main();
