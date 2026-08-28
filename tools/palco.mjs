#!/usr/bin/env node
// Prepara a maquina para a oficina e sobe o deck.
//
//   node tools/palco.mjs            # confere tudo, arruma o que da, e sobe
//   node tools/palco.mjs --so-checar   # so o diagnostico, nao sobe nada
//
// E o comando da manha do dia. Confere o toolchain, garante que o palco esta no
// estado inicial, sobe o banco, valida as gravacoes e serve o deck -- parando
// com mensagem clara no primeiro problema, em vez de deixar a falha aparecer com
// a sala cheia.
//
// O deck e servido do worktree do palco, e nao da main: la openspec/ e
// fhir-facade/ nao existem, que e como a oficina comeca.

import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverClaude, versaoDoClaude } from './claude-bin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PALCO = resolve(ROOT, '..', 'gointerop-palco');
const BRANCH = 'palco-inicio';
const PORTA = 4173;
const SO_CHECAR = process.argv.includes('--so-checar');

const c = { ok: '\x1b[32m', erro: '\x1b[31m', aviso: '\x1b[33m', fraco: '\x1b[2m', forte: '\x1b[1m', fim: '\x1b[0m' };
const linha = (marca, texto, cor = '') => console.log(`  ${cor}${marca}${c.fim} ${texto}`);
const ok = (t) => linha('✔', t, c.ok);
const aviso = (t) => linha('!', t, c.aviso);
const titulo = (t) => console.log(`\n${c.forte}${t}${c.fim}`);

const problemas = [];
function falhar(t, conserto) {
  linha('✘', t, c.erro);
  if (conserto) console.log(`    ${c.fraco}${conserto}${c.fim}`);
  problemas.push(t);
}

/**
 * Executa sem shell. O shell parece resolver o shim .cmd do Windows, mas quebra
 * tudo que tem espaco no caminho ou chave no argumento -- o proprio node.exe em
 * "Program Files" e o {{.ServerVersion}} do docker.
 *
 * Para o punhado de comandos que sao shim .cmd, o caminho e passar por
 * `cmd /c`, que resolve o nome pelo PATH sem concatenar os argumentos.
 */
const rodar = (cmd, args, { shim = false, ...opts } = {}) => {
  const usarCmd = shim && process.platform === 'win32';
  return execFileSync(
    usarCmd ? 'cmd' : cmd,
    usarCmd ? ['/c', cmd, ...args] : args,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts },
  ).trim();
};

/** Porta ocupada, sem depender de curl estar instalado. */
const portaOcupada = (porta) => new Promise((pronto) => {
  const s = createConnection({ port: porta, host: '127.0.0.1' });
  const fim = (r) => { s.destroy(); pronto(r); };
  s.setTimeout(1200);
  s.on('connect', () => fim(true));
  s.on('error', () => fim(false));
  s.on('timeout', () => fim(false));
});

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ toolchain --
titulo('Toolchain');

// A versao do Node vem do proprio processo; nao ha por que abrir um subprocesso
// so para perguntar a ele mesmo.
ok(`Node ${process.version}`);

for (const [nome, cmd, args, shim, conserto] of [
  ['Java', 'java', ['--version'], false, 'winget install EclipseAdoptium.Temurin.25.JDK'],
  ['Maven', 'mvn', ['--version'], true, 'winget install Apache.Maven'],
  ['Git', 'git', ['--version'], false, null],
]) {
  try { ok(`${nome} ${rodar(cmd, args, { shim }).split('\n')[0]}`); }
  catch { falhar(`${nome} nao encontrado`, conserto); }
}

let CLAUDE = null;
try {
  CLAUDE = resolverClaude();
  const v = versaoDoClaude(CLAUDE.comando);
  if (v) ok(`Claude Code ${v}`);
  else falhar('Claude Code nao respondeu', 'rode `claude` no terminal e confirme o login');
} catch (e) {
  falhar('Claude Code indisponivel', e.message.split('\n').find((l) => l.trim()) ?? '');
}

// --------------------------------------------------------------- palco --
titulo('Palco');

if (!existsSync(PALCO)) {
  if (SO_CHECAR) falhar('worktree do palco ausente', `git worktree add "${PALCO}" ${BRANCH}`);
  else {
    try {
      rodar('git', ['worktree', 'add', PALCO, BRANCH], { cwd: ROOT });
      ok(`worktree criado em ${PALCO}`);
    } catch (e) { falhar('nao consegui criar o worktree', e.message.split('\n')[0]); }
  }
} else {
  ok(`worktree em ${PALCO}`);
}

if (existsSync(PALCO)) {
  // O estado inicial e o que faz a demo funcionar: os dois diretorios nascem ao
  // vivo. Um ensaio anterior deixa restos, e uma sessao pendente faria o
  // primeiro passo retomar a cadeia velha em vez de abrir uma nova.
  const restos = ['openspec', 'fhir-facade'].filter((d) => existsSync(join(PALCO, d)));
  if (restos.length) {
    if (SO_CHECAR) aviso(`restos de ensaio: ${restos.join(', ')}`);
    else { restos.forEach((d) => rmSync(join(PALCO, d), { recursive: true, force: true })); ok(`restos removidos: ${restos.join(', ')}`); }
  } else ok('estado inicial limpo — openspec/ e fhir-facade/ ausentes');

  const rec = join(PALCO, 'deck', 'recordings');
  const sessao = join(rec, '.session');
  if (existsSync(sessao)) {
    if (SO_CHECAR) aviso('sessao pendente de ensaio anterior');
    else { unlinkSync(sessao); ok('sessao zerada — a primeira cadeia nasce nova'); }
  } else ok('sem sessao pendente');

  if (!SO_CHECAR) {
    for (const f of readdirSync(rec).filter((x) => x.endsWith('.parcial'))) unlinkSync(join(rec, f));
  }

  const gravacoes = existsSync(rec) ? readdirSync(rec).filter((f) => /^step-\d+\.jsonl$/.test(f)) : [];
  if (gravacoes.length === 7) ok('7 gravacoes — rede de seguranca completa');
  else falhar(`${gravacoes.length} de 7 gravacoes`, 'node tools/run-step.mjs --list');
}

// --------------------------------------------------------------- banco --
titulo('Banco legado');

let docker = false;
try { rodar('docker', ['info', '--format', '{{.ServerVersion}}']); docker = true; ok('Docker respondendo'); }
catch {
  if (SO_CHECAR || process.platform !== 'win32') {
    falhar('Docker nao esta rodando', 'abra o Docker Desktop');
  } else {
    aviso('Docker parado — abrindo o Docker Desktop');
    try {
      spawn('cmd', ['/c', 'start', '', 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'], { detached: true, stdio: 'ignore' }).unref();
      for (let i = 0; i < 60 && !docker; i++) {
        await espera(3000);
        try { rodar('docker', ['info', '--format', '{{.ServerVersion}}']); docker = true; } catch { /* ainda subindo */ }
      }
      docker ? ok('Docker no ar') : falhar('Docker nao subiu a tempo', 'abra o Docker Desktop e rode de novo');
    } catch { falhar('nao consegui abrir o Docker Desktop', 'abra manualmente'); }
  }
}

if (docker) {
  if (!SO_CHECAR) {
    try { rodar('docker', ['compose', '-f', join(ROOT, 'legacy-db', 'docker-compose.yml'), 'up', '-d']); }
    catch (e) { falhar('falha ao subir o contêiner', e.message.split('\n')[0]); }
  }
  let saudavel = false;
  for (let i = 0; i < 40 && !saudavel; i++) {
    try { saudavel = rodar('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'sigh-db']) === 'healthy'; } catch { /* subindo */ }
    if (!saudavel) await espera(2000);
  }
  if (saudavel) {
    ok('contêiner saudavel');
    try {
      const n = rodar('docker', ['exec', 'sigh-db', 'psql', '-U', 'sigh_app', '-d', 'sigh', '-t', '-A',
        '-c', 'SELECT count(*) FROM sigh.paciente;']);
      n === '200' ? ok('200 pacientes') : falhar(`${n} pacientes — esperado 200`, 'node tools/gen-seed.mjs e recrie o contêiner');
    } catch (e) { falhar('nao consegui consultar o banco', e.message.split('\n')[0]); }
  } else falhar('contêiner nao ficou saudavel', 'docker compose -f legacy-db/docker-compose.yml logs');
}

// ---------------------------------------------------------------- deck --
titulo('Deck');

if (await portaOcupada(PORTA)) {
  aviso(`ja ha algo escutando em ${PORTA} — encerre antes, ou suba com --port ${PORTA + 1}`);
} else {
  ok(`porta ${PORTA} livre`);
}

if (problemas.length) {
  console.log(`\n${c.erro}${c.forte}  ${problemas.length} problema(s) — resolva antes de subir o deck.${c.fim}\n`);
  process.exit(1);
}

if (SO_CHECAR) {
  console.log(`\n${c.ok}${c.forte}  Tudo pronto.${c.fim} Para subir o deck:  ${c.forte}node tools/palco.mjs${c.fim}\n`);
  process.exit(0);
}

console.log(`
${c.forte}  Checklist do palco${c.fim}
    Fonte do terminal em 18pt ou mais
    Notificacoes e atualizacoes do sistema desligadas
    Slide 1 na tela quando a plateia entrar

${c.forte}  No dia${c.fim}
    Passos nos slides 20, 24, 25, 28, 29, 31 e 32
    ${c.aviso}Passo 04 leva 35 min ao vivo e o bloco tem 30 — use ${c.forte}R${c.fim}${c.aviso} antes do ${c.forte}S${c.fim}${c.aviso} nele${c.fim}
    Travou? ${c.forte}Esc${c.fim} ${c.forte}R${c.fim} ${c.forte}S${c.fim} — o REPLAY assume e a sala nao percebe
`);

const runner = spawn(process.execPath, [join(PALCO, 'deck', 'runner.mjs')], { cwd: PALCO, stdio: 'inherit' });
process.on('SIGINT', () => { runner.kill(); process.exit(0); });
