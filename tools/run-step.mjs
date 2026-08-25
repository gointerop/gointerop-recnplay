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
import { createWriteStream, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

const gravacaoDe = (id) => resolve(REC_DIR, `step-${id}.jsonl`);

/** Uma gravacao so conta quando tem conteudo. Arquivo vazio sobra de run interrompido. */
function temGravacao(id) {
  const f = gravacaoDe(id);
  return existsSync(f) && statSync(f).size > 0;
}

/**
 * Identificador da cadeia de passos.
 *
 * E gerado a cada nova cadeia, e nao fixado no steps.json: um id fixo so pode ser
 * usado uma vez por maquina, e o Claude Code recusa a segunda tentativa com
 * "Session ID already in use". Com id fixo, ensaiar duas vezes seria impossivel —
 * e o dia da oficina colidiria com o ultimo ensaio.
 */
function sessaoAtual() {
  if (existsSync(STATE_FILE)) return { id: readFileSync(STATE_FILE, 'utf8').trim(), nova: false };
  return { id: randomUUID(), nova: true };
}

if (args.includes('--list') || args.length === 0) {
  const s = sessaoAtual();
  console.log(`\nsessao: ${s.id}${s.nova ? '  (nova — nenhum passo executado ainda)' : ''}\n`);
  for (const step of cfg.steps) {
    console.log(`  ${temGravacao(step.id) ? '●' : '○'} ${step.id}  ${step.title}`);
  }
  console.log('\n  ● gravado   ○ pendente\n');
  process.exit(0);
}

if (args.includes('--reset')) {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
  console.log('sessao zerada — o proximo passo abre uma nova, com id novo.');
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
    const { id: session, nova: first } = sessaoAtual();

    // O prompt vai por stdin, nunca por argv: um prompt multilinha com aspas
    // seria destruido caso o spawn precisasse passar por um shell.
    const argv = [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      // Prompt em portugues nao garante resposta em portugues, e o texto do
      // agente vai projetado para a plateia.
      ...(cfg.instrucaoDeSistema ? ['--append-system-prompt', cfg.instrucaoDeSistema] : []),
      ...(first ? ['--session-id', session] : ['--resume', session]),
    ];

    console.log(`\n\x1b[1m▌ passo ${step.id} — ${step.title}\x1b[0m`);
    console.log(`\x1b[2m  ${first ? 'nova sessao' : 'retomando'} ${session}\x1b[0m`);

    // Grava em arquivo parcial e so promove se a execucao terminar bem — uma
    // tentativa que falha nao pode destruir a gravacao boa do passo.
    const parcial = gravacaoDe(step.id) + '.parcial';
    mkdirSync(REC_DIR, { recursive: true });
    const rec = createWriteStream(parcial);
    const proc = spawn(CLAUDE.comando, argv, { cwd: ROOT, shell: CLAUDE.shell });
    // A instrucao de idioma vai tambem no corpo do prompt, e nao so em
    // --append-system-prompt: sozinha, a instrucao de sistema nao venceu o
    // idioma do restante do prompt, e o agente respondia em ingles.
    proc.stdin.write(cfg.instrucaoDeSistema
      ? `${cfg.instrucaoDeSistema}

---

${step.prompt}`
      : step.prompt);
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
      rec.end(() => {
        try {
          if (code === 0 && statSync(parcial).size > 0) renameSync(parcial, gravacaoDe(step.id));
          else unlinkSync(parcial);
        } catch (e) {
          console.error('  aviso: nao foi possivel salvar a gravacao —', e.message);
        }
      });
      try {
        if (first && code === 0) {
          mkdirSync(REC_DIR, { recursive: true });
          writeFileSync(STATE_FILE, session, 'utf8');
        }
      } catch (e) {
        console.error('  aviso: nao foi possivel gravar a sessao —', e.message);
      }
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
