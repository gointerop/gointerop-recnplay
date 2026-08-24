#!/usr/bin/env node
// Executa um passo da oficina com o Claude Code em modo headless e grava o
// stream-json bruto em deck/recordings/, que alimenta o modo REPLAY do deck.
//
//   node tools/run-step.mjs 01            # roda o passo 01
//   node tools/run-step.mjs 01 02 03      # roda em sequencia
//   node tools/run-step.mjs --list        # lista os passos
//   node tools/run-step.mjs --reset       # zera a sessao (proximo passo abre nova)
//
// A sessao e compartilhada entre os passos: o primeiro passo cria a sessao com
// --session-id e os seguintes retomam com --resume. E o que permite encadear os
// prompts slide a slide sem perder contexto.

import { spawn } from 'node:child_process';
import { createWriteStream, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverClaude, versaoDoClaude } from './claude-bin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STEPS_FILE = resolve(ROOT, 'deck/steps.json');
const REC_DIR = resolve(ROOT, 'deck/recordings');
const STATE_FILE = resolve(REC_DIR, '.session');

const cfg = JSON.parse(readFileSync(STEPS_FILE, 'utf8'));
const args = process.argv.slice(2);

mkdirSync(REC_DIR, { recursive: true });

if (args.includes('--list') || args.length === 0) {
  console.log(`\nsessao: ${cfg.sessionId}\n`);
  for (const s of cfg.steps) {
    const rec = resolve(REC_DIR, `step-${s.id}.jsonl`);
    const mark = existsSync(rec) ? '●' : '○';
    console.log(`  ${mark} ${s.id}  ${s.title}`);
  }
  console.log('\n  ● gravado   ○ pendente\n');
  process.exit(0);
}

if (args.includes('--reset')) {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
  console.log('sessao zerada — o proximo passo abre uma nova.');
  process.exit(0);
}

// --- Render condensado do stream-json ---------------------------------------
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function render(ev) {
  if (ev.type === 'assistant' && ev.message?.content) {
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text.trim()) {
        process.stdout.write(`\n${c.text.trim()}\n`);
      } else if (c.type === 'tool_use') {
        const i = c.input ?? {};
        const detail = i.command ?? i.file_path ?? i.pattern ?? i.path ?? i.prompt ?? '';
        console.log(`  \x1b[36m→ ${c.name}\x1b[0m ${trunc(String(detail).replace(/\s+/g, ' '), 110)}`);
      }
    }
  } else if (ev.type === 'result') {
    const min = ((ev.duration_ms ?? 0) / 60000).toFixed(1);
    const cost = ev.total_cost_usd != null ? ` · US$ ${ev.total_cost_usd.toFixed(2)}` : '';
    console.log(`\n\x1b[32m✔ ${min} min · ${ev.num_turns ?? '?'} turnos${cost}\x1b[0m`);
  }
}

// --- Execucao de um passo ----------------------------------------------------
function runStep(step) {
  return new Promise((done, fail) => {
    const first = !existsSync(STATE_FILE);
    const session = first ? cfg.sessionId : readFileSync(STATE_FILE, 'utf8').trim();

    // O prompt vai por stdin, nunca por argv: no Windows o spawn precisa de
    // shell:true para resolver o claude.cmd, e ai os argumentos sao apenas
    // concatenados — um prompt multilinha com aspas seria destruido.
    const argv = [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      ...(first ? ['--session-id', session] : ['--resume', session]),
    ];

    console.log(`\n\x1b[1m▌ passo ${step.id} — ${step.title}\x1b[0m`);
    console.log(`\x1b[2m  ${first ? 'nova sessao' : 'retomando'} ${session}\x1b[0m`);

    const rec = createWriteStream(resolve(REC_DIR, `step-${step.id}.jsonl`));
    const proc = spawn(CLAUDE.comando, argv, { cwd: ROOT, shell: CLAUDE.shell });
    proc.stdin.write(step.prompt);
    proc.stdin.end();

    let buf = '';
    proc.stdout.on('data', (chunk) => {
      rec.write(chunk);
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { render(JSON.parse(line)); } catch { /* linha parcial */ }
      }
    });
    proc.stderr.on('data', (c) => process.stderr.write(c));

    proc.on('close', (code) => {
      rec.end();
      if (first) writeFileSync(STATE_FILE, session, 'utf8');
      code === 0 ? done() : fail(new Error(`passo ${step.id} saiu com codigo ${code}`));
    });
  });
}

// --- Sequenciamento ----------------------------------------------------------
let CLAUDE;
try {
  CLAUDE = resolverClaude();
} catch (e) {
  console.error('\n' + e.message);
  process.exit(1);
}
const versao = versaoDoClaude(CLAUDE.comando);
console.log(`claude ${versao ?? '(nao respondeu — verifique a autenticacao com: claude)'}  [${CLAUDE.origem}]`);

const wanted = args.filter((a) => !a.startsWith('--'));
for (const id of wanted) {
  const step = cfg.steps.find((s) => s.id === id);
  if (!step) { console.error(`passo ${id} nao existe`); process.exit(1); }
  await runStep(step);
}
console.log(`\ngravacoes em deck/recordings/\n`);
