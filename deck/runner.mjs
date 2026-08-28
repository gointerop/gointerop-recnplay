#!/usr/bin/env node
// Runner da oficina "Descomplicando o FHIR".
//
// Serve o deck e liga os slides ao Claude Code: avancar para um slide de demo
// dispara o passo correspondente de steps.json, o stream do agente vai para o
// painel lateral por SSE e o watcher mostra os arquivos nascendo.
//
//   node deck/runner.mjs              # http://localhost:4173
//   node deck/runner.mjs --port 8080
//
// Sem dependencia externa: HTTP e fs.watch nativos.

import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, renameSync, statSync, readdirSync, watch } from 'node:fs';
import { resolve, dirname, join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { resolverClaude, versaoDoClaude } from '../tools/claude-bin.mjs';

const DECK = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DECK, '..');
const REC_DIR = resolve(DECK, 'recordings');
const STATE = resolve(REC_DIR, '.session');
const STEPS = JSON.parse(readFileSync(resolve(DECK, 'steps.json'), 'utf8'));

const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 4173;

// Diretorios que nascem durante a oficina e alimentam a arvore lateral.
const WATCHED = ['openspec', 'fhir-facade'];

mkdirSync(REC_DIR, { recursive: true });

// Resolvido na subida, e nao no primeiro disparo: melhor descobrir que o
// Claude Code esta quebrado durante a montagem do que com a sala cheia.
let CLAUDE = null;
let CLAUDE_ERRO = null;
try {
  CLAUDE = resolverClaude();
} catch (e) {
  CLAUDE_ERRO = e.message;
}

// ---------------------------------------------------------------- SSE --------
const clients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// ------------------------------------------------------------ arvore --------
const IGNORE = new Set(['node_modules', '.git', 'target', '.idea', '.vscode']);

function walk(abs, base, out = [], depth = 0) {
  if (depth > 12 || !existsSync(abs)) return out;
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
    if (IGNORE.has(e.name) || e.name.startsWith('.')) continue;
    const full = join(abs, e.name);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (e.isDirectory()) {
      out.push({ path: rel, name: e.name, dir: true, depth });
      walk(full, base, out, depth + 1);
    } else {
      let size = 0;
      try { size = statSync(full).size; } catch { /* corrida com o agente */ }
      out.push({ path: rel, name: e.name, dir: false, depth, size });
    }
  }
  return out;
}

const tree = () => WATCHED.flatMap((d) => walk(resolve(ROOT, d), d));

// ----------------------------------------------------------- watcher --------
// Os diretorios ainda nao existem quando o runner sobe. Tentamos observar cada
// um periodicamente ate ele aparecer.
const watching = new Map();
let treeTimer = null;

function scheduleTree() {
  clearTimeout(treeTimer);
  treeTimer = setTimeout(() => broadcast('tree', tree()), 150);
}

function tryWatch() {
  for (const d of WATCHED) {
    if (watching.has(d)) continue;
    const abs = resolve(ROOT, d);
    if (!existsSync(abs)) continue;
    try {
      const w = watch(abs, { recursive: true }, (_type, file) => {
        if (!file) return scheduleTree();
        const rel = `${d}/${String(file).split(sep).join('/')}`;
        if (rel.includes('/.') || rel.includes('node_modules') || rel.includes('/target/')) return;
        broadcast('file', { path: rel });
        scheduleTree();
      });
      watching.set(d, w);
      scheduleTree();
    } catch { /* tenta de novo no proximo ciclo */ }
  }
}
tryWatch();
setInterval(tryWatch, 2000).unref?.();

// -------------------------------------------------------- execucao ----------
let running = null; // { id, kill }

function stepById(id) {
  return STEPS.steps.find((s) => s.id === id);
}

/** Caminho da gravacao de um passo. */
const gravacaoDe = (id) => resolve(REC_DIR, `step-${id}.jsonl`);

/**
 * Uma gravacao so vale se tiver conteudo. Um arquivo vazio sobra de execucao
 * interrompida e, se contasse como gravacao, o REPLAY terminaria em silencio no
 * meio da oficina.
 */
function temGravacao(id) {
  const f = gravacaoDe(id);
  return existsSync(f) && statSync(f).size > 0;
}

/**
 * Identificador da cadeia de passos, gerado a cada nova cadeia. Ver o comentario
 * equivalente em tools/run-step.mjs: id fixo so serve uma vez por maquina.
 */
function sessaoAtual() {
  if (existsSync(STATE)) return { id: readFileSync(STATE, 'utf8').trim(), nova: false };
  return { id: randomUUID(), nova: true };
}

function runLive(step) {
  const { id: session, nova: first } = sessaoAtual();

  // O prompt vai por stdin, nunca por argv — ver comentario em tools/run-step.mjs.
  const argv = [
    '-p',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode', 'bypassPermissions',
    // Prompt em portugues nao garante resposta em portugues, e o texto do
    // agente vai projetado para a plateia.
    ...(STEPS.instrucaoDeSistema ? ['--append-system-prompt', STEPS.instrucaoDeSistema] : []),
    ...(first ? ['--session-id', session] : ['--resume', session]),
  ];

  if (!CLAUDE) {
    broadcast('falha', { id: step.id, message: CLAUDE_ERRO });
    broadcast('step-end', { id: step.id, code: 1 });
    return;
  }

  // A gravacao vai primeiro para um arquivo temporario, e so vira gravacao se o
  // passo ainda nao tiver uma. Uma execucao LIVE aqui e apresentacao ou teste,
  // nao sessao de gravacao: sobrescrever destruiria justamente o REPLAY que
  // serve de rede de seguranca. Para regravar de proposito, use
  // tools/run-step.mjs, que sobrescreve por ser essa a sua funcao.
  const parcial = gravacaoDe(step.id) + '.parcial';
  // O diretorio e garantido a cada passo, e nao so na subida: ele pode
  // desaparecer no meio da sessao — uma troca de branch remove um diretorio que
  // ficou sem arquivo rastreado.
  mkdirSync(REC_DIR, { recursive: true });
  const rec = createWriteStream(parcial);
  const proc = spawn(CLAUDE.comando, argv, { cwd: ROOT, shell: CLAUDE.shell });
  // A instrucao de idioma vai tambem no corpo do prompt, e nao so em
    // --append-system-prompt: sozinha, a instrucao de sistema nao venceu o
    // idioma do restante do prompt, e o agente respondia em ingles.
    proc.stdin.write(STEPS.instrucaoDeSistema
      ? `${STEPS.instrucaoDeSistema}

---

${step.prompt}`
      : step.prompt);
  proc.stdin.end();

  broadcast('step-start', { id: step.id, title: step.title, mode: 'live' });

  let buf = '';
  proc.stdout.on('data', (chunk) => {
    rec.write(chunk);
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try { broadcast('agent', JSON.parse(line)); } catch { /* linha parcial */ }
    }
  });
  proc.stderr.on('data', (c) => broadcast('stderr', { text: c.toString('utf8') }));

  proc.on('close', (code) => {
    // Nada aqui pode lancar: uma excecao neste callback derruba o servidor
    // inteiro, e no palco isso significa perder o deck no meio da oficina.
    rec.end(() => {
      try {
        if (code === 0 && statSync(parcial).size > 0 && !temGravacao(step.id)) {
          renameSync(parcial, gravacaoDe(step.id));
          console.log(`  gravacao do passo ${step.id} criada`);
        } else {
          if (temGravacao(step.id)) {
            console.log(`  passo ${step.id} ja tinha gravacao — preservada`);
          }
          unlinkSync(parcial);
        }
      } catch (e) {
        console.error('  aviso: nao foi possivel salvar a gravacao —', e.message);
      }
    });
    try {
      if (first && code === 0) {
        mkdirSync(REC_DIR, { recursive: true });
        writeFileSync(STATE, session, 'utf8');
      }
    } catch (e) {
      console.error('  aviso: nao foi possivel gravar a sessao —', e.message);
    }
    running = null;
    broadcast('step-end', { id: step.id, code });
  });

  running = { id: step.id, kill: () => proc.kill() };
}

/**
 * Traz para o disco os artefatos que o passo teria produzido.
 *
 * O REPLAY reproduz o stream, nao executa nada — nenhum arquivo nasce. Sem isso,
 * replicar o passo 04 deixaria o projeto vazio e o passo 05, que roda mvn verify
 * de verdade, nao teria o que verificar. O watcher mostra os arquivos chegando,
 * entao o efeito na tela e o mesmo da execucao ao vivo.
 */
function materializar(step) {
  if (!step.materializa?.length) return;
  const ref = STEPS.referenciaMaterializacao ?? 'main';
  try {
    // git archive extrai sem tocar no indice. Um "git checkout ref -- dir" faria
    // o mesmo no disco, mas deixaria os arquivos preparados para commit -- e foi
    // assim que openspec/ e fhir-facade/ acabaram versionados na branch do palco.
    const tar = execFileSync('git', ['archive', ref, '--', ...step.materializa],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    execFileSync('tar', ['-x'], { cwd: ROOT, input: tar });
    scheduleTree();
    console.log(`  materializado de ${ref}: ${step.materializa.join(', ')}`);
  } catch (e) {
    broadcast('falha', {
      id: step.id,
      message: `nao foi possivel materializar ${step.materializa.join(', ')} a partir de ${ref}: ${e.message}`,
    });
  }
}

function runReplay(step, speed = 6) {
  const file = gravacaoDe(step.id);
  if (!temGravacao(step.id)) {
    broadcast('falha', {
      id: step.id,
      message: `sem gravação para o passo ${step.id} — rode: node tools/run-step.mjs ${step.id}`,
    });
    return;
  }
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  broadcast('step-start', { id: step.id, title: step.title, mode: 'replay' });

  let i = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    if (i >= lines.length) {
      running = null;
      materializar(step);
      broadcast('step-end', { id: step.id, code: 0 });
      return;
    }
    try { broadcast('agent', JSON.parse(lines[i])); } catch { /* linha invalida */ }
    i++;
    // Ritmo constante e legivel: a plateia precisa conseguir ler.
    setTimeout(tick, Math.max(12, 220 / speed));
  };
  running = { id: step.id, kill: () => { stopped = true; running = null; } };
  setTimeout(tick, 200);
}

// ------------------------------------------------------------ HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
};

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

function atender(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // --- SSE ---
  if (p === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    res.write(`event: tree\ndata: ${JSON.stringify(tree())}\n\n`);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch { /* fechado */ } }, 15000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  // --- metadados dos passos ---
  if (p === '/api/steps') {
    return json(res, 200, {
      sessionId: sessaoAtual().id,
      steps: STEPS.steps.map((s) => ({
        id: s.id, slide: s.slide, title: s.title, bloco: s.bloco,
        prompt: s.prompt,
        gravado: temGravacao(s.id),
      })),
      running: running?.id ?? null,
    });
  }

  // --- disparar passo ---
  if (p.startsWith('/api/run/') && req.method === 'POST') {
    const id = p.split('/').pop();
    const step = stepById(id);
    if (!step) return json(res, 404, { error: `passo ${id} nao existe` });
    if (running) return json(res, 409, { error: `passo ${running.id} em execucao` });
    const mode = url.searchParams.get('mode') === 'replay' ? 'replay' : 'live';
    mode === 'replay' ? runReplay(step, Number(url.searchParams.get('speed')) || 6) : runLive(step);
    return json(res, 202, { id, mode });
  }

  // --- abortar ---
  if (p === '/api/stop' && req.method === 'POST') {
    running?.kill();
    running = null;
    broadcast('step-end', { id: null, code: -1 });
    return json(res, 200, { ok: true });
  }

  // --- zerar sessao ---
  if (p === '/api/session/reset' && req.method === 'POST') {
    if (existsSync(STATE)) unlinkSync(STATE);
    return json(res, 200, { ok: true });
  }

  // --- arvore e conteudo de arquivo ---
  if (p === '/api/tree') return json(res, 200, tree());

  if (p === '/api/file') {
    const rel = url.searchParams.get('p') ?? '';
    const abs = resolve(ROOT, rel);
    // Confina a leitura ao repositorio.
    if (!abs.startsWith(ROOT) || !existsSync(abs) || statSync(abs).isDirectory()) {
      return json(res, 404, { error: 'nao encontrado' });
    }
    const size = statSync(abs).size;
    if (size > 400_000) return json(res, 200, { path: rel, text: '[arquivo grande demais para exibir]' });
    return json(res, 200, { path: rel, text: readFileSync(abs, 'utf8') });
  }

  // --- estaticos do deck ---
  const file = resolve(DECK, p === '/' ? 'index.html' : '.' + p);
  if (!file.startsWith(DECK) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

const servidor = createServer(atender);

// Porta ocupada e o erro mais provavel na hora da montagem: quase sempre e um
// runner esquecido de um ensaio anterior. Com a sala cheia, uma mensagem clara
// vale mais do que um stack trace.
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORT} ja esta em uso.`);
    console.error('  Provavelmente ha outro runner rodando. Encerre-o, ou use:');
    console.error(`      node deck/runner.mjs --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw e;
});

servidor.listen(PORT, () => {
  console.log(`\n  deck   http://localhost:${PORT}`);
  console.log(`  passos ${STEPS.steps.length}   sessao ${sessaoAtual().id}`);
  console.log(`  observando ${WATCHED.join(', ')}`);

  if (CLAUDE) {
    const v = versaoDoClaude(CLAUDE.comando);
    console.log(`  claude ${v ?? '(nao respondeu — verifique a autenticacao)'}  [${CLAUDE.origem}]\n`);
  } else {
    console.log('\n  ATENCAO — o modo LIVE nao vai funcionar:\n');
    console.log(CLAUDE_ERRO.split('\n').map((l) => '  ' + l).join('\n'));
    console.log('  O modo REPLAY continua funcionando normalmente.\n');
  }
});
