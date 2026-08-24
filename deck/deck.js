/* -------------------------------------------------------------------
   Deck da oficina. Navega os slides e conversa com o runner por SSE.

   Um slide com data-step esta ligado a um passo de steps.json: ao entrar
   nele o painel lateral abre, e a tecla S dispara o passo. O modo LIVE
   executa o Claude Code de verdade; o modo REPLAY reproduz a gravacao do
   ensaio. A troca e instantanea, pela tecla R.
   ------------------------------------------------------------------- */

const slides = [...document.querySelectorAll('.slide')];
const palco = document.getElementById('palco');
const fluxo = document.getElementById('fluxo');
const arvore = document.getElementById('arquivos');

const ui = {
  titulo: document.getElementById('painel-titulo'),
  modo: document.getElementById('painel-modo'),
  estado: document.getElementById('painel-estado'),
  cronometro: document.getElementById('painel-cronometro'),
  bloco: document.getElementById('rodape-bloco'),
  hora: document.getElementById('rodape-hora'),
  n: document.getElementById('rodape-n'),
  total: document.getElementById('rodape-total'),
  progresso: document.getElementById('progresso'),
  ajuda: document.getElementById('ajuda'),
};

let atual = 0;
let modo = 'live';
let rodando = null;
let inicio = 0;
let passos = {};

ui.total.textContent = slides.length;

// ------------------------------------------------------------ slides --

function mostrar(i) {
  atual = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => s.classList.toggle('ativo', k === atual));

  const slide = slides[atual];
  const step = slide.dataset.step;

  palco.classList.toggle('com-painel', Boolean(step));
  if (step && passos[step]) {
    ui.titulo.textContent = `passo ${step} — ${passos[step].title}`;
  }

  ui.bloco.textContent = slide.dataset.bloco ?? '';
  ui.hora.textContent = slide.dataset.hora ?? '';
  ui.n.textContent = atual + 1;
  ui.progresso.style.width = `${((atual + 1) / slides.length) * 100}%`;

  location.hash = String(atual + 1);
}

// ------------------------------------------------------------ painel --

function limpar() {
  fluxo.replaceChildren();
  arvore.replaceChildren(Object.assign(document.createElement('div'),
    { className: 'vazio', textContent: 'os arquivos aparecem aqui conforme nascem' }));
}

function linha(classe, texto) {
  const el = document.createElement('div');
  el.className = classe;
  el.textContent = texto;
  fluxo.append(el);
  fluxo.scrollTop = fluxo.scrollHeight;
  return el;
}

function ferramenta(nome, argumento) {
  const el = document.createElement('div');
  el.className = 'ferramenta';
  const n = document.createElement('span');
  n.className = 'nome';
  n.textContent = nome;
  const a = document.createElement('span');
  a.className = 'arg';
  a.textContent = argumento;
  el.append(n, a);
  fluxo.append(el);
  fluxo.scrollTop = fluxo.scrollHeight;
}

/** Traduz um evento do stream-json do Claude Code para o painel. */
function renderizarAgente(ev) {
  if (ev.type === 'assistant' && ev.message?.content) {
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text.trim()) {
        linha('texto', c.text.trim());
      } else if (c.type === 'tool_use') {
        const i = c.input ?? {};
        const detalhe = i.command ?? i.file_path ?? i.pattern ?? i.path ?? i.prompt ?? '';
        ferramenta(c.name, String(detalhe).replace(/\s+/g, ' ').slice(0, 160));
      }
    }
  } else if (ev.type === 'result') {
    const min = ((ev.duration_ms ?? 0) / 60000).toFixed(1);
    linha('fim', `concluído em ${min} min`);
  }
}

// ---------------------------------------------------------- arquivos --

const vistos = new Set();

function desenharArvore(itens) {
  if (!itens.length) return;
  arvore.replaceChildren();
  for (const item of itens) {
    const el = document.createElement('div');
    el.className = 'no' + (item.dir ? ' dir' : '');
    el.style.paddingLeft = `${0.4 + item.depth * 0.9}rem`;

    const nome = document.createElement('span');
    nome.textContent = (item.dir ? '▸ ' : '') + item.name;
    el.append(nome);

    if (!item.dir) {
      const tam = document.createElement('span');
      tam.className = 'tam';
      tam.textContent = item.size > 1024 ? `${(item.size / 1024).toFixed(1)}k` : `${item.size}`;
      el.append(tam);
    }
    if (!vistos.has(item.path)) {
      vistos.add(item.path);
      el.classList.add('novo');
    }
    arvore.append(el);
  }
}

// --------------------------------------------------------- cronometro --

setInterval(() => {
  if (!rodando) return;
  const s = Math.floor((Date.now() - inicio) / 1000);
  ui.cronometro.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}, 500);

// --------------------------------------------------------------- SSE --

function conectar() {
  const fonte = new EventSource('/events');

  fonte.addEventListener('tree', (e) => desenharArvore(JSON.parse(e.data)));
  fonte.addEventListener('agent', (e) => renderizarAgente(JSON.parse(e.data)));

  fonte.addEventListener('step-start', (e) => {
    const d = JSON.parse(e.data);
    rodando = d.id;
    inicio = Date.now();
    ui.estado.hidden = false;
    linha('aviso', `▌ passo ${d.id} — ${d.title}  [${d.mode.toUpperCase()}]`);
  });

  fonte.addEventListener('step-end', (e) => {
    const d = JSON.parse(e.data);
    rodando = null;
    ui.estado.hidden = true;
    if (d.code === 0) linha('fim', '▌ passo concluído');
    else if (d.code === -1) linha('aviso', '▌ passo abortado');
    else linha('erro', `▌ passo terminou com código ${d.code}`);
  });

  // O nome 'error' e reservado pelo EventSource para falha de conexao. Um evento
  // de aplicacao com esse nome ficaria indistinguivel de queda do runner.
  fonte.addEventListener('falha', (e) => linha('erro', JSON.parse(e.data).message));

  fonte.addEventListener('stderr', (e) => linha('erro', JSON.parse(e.data).text.trim()));
}

// ------------------------------------------------------------- acoes --

async function disparar() {
  const step = slides[atual].dataset.step;
  if (!step) return linha('aviso', 'este slide não tem passo ligado');
  if (rodando) return linha('aviso', `passo ${rodando} ainda em execução`);

  const r = await fetch(`/api/run/${step}?mode=${modo}`, { method: 'POST' });
  if (!r.ok) linha('erro', (await r.json()).error ?? 'falha ao disparar');
}

const abortar = () => fetch('/api/stop', { method: 'POST' });

function alternarModo() {
  modo = modo === 'live' ? 'replay' : 'live';
  ui.modo.textContent = modo.toUpperCase();
  ui.modo.className = `pill ${modo}`;
}

// ---------------------------------------------------------- teclado --

addEventListener('keydown', (e) => {
  if (e.key === '?') { ui.ajuda.classList.toggle('aberta'); return; }
  if (ui.ajuda.classList.contains('aberta') && e.key === 'Escape') {
    ui.ajuda.classList.remove('aberta');
    return;
  }
  switch (e.key) {
    case 'ArrowRight': case ' ': case 'PageDown': mostrar(atual + 1); break;
    case 'ArrowLeft': case 'PageUp': mostrar(atual - 1); break;
    case 'Home': mostrar(0); break;
    case 'End': mostrar(slides.length - 1); break;
    case 's': case 'S': disparar(); break;
    case 'r': case 'R': alternarModo(); break;
    case 'l': case 'L': limpar(); break;
    case 'Escape': abortar(); break;
  }
});

// ------------------------------------------------------------ inicio --

/**
 * Injeta as ilustracoes das personas.
 *
 * Ficam num arquivo separado para nao inchar o index.html, e sao injetadas em vez
 * de referenciadas por <use href="arquivo.svg#id">: o Chrome nao resolve <use>
 * para documento externo. Depois da injecao, os href sao reescritos para forcar a
 * re-resolucao dos <use> que ja estavam no DOM.
 */
async function carregarPessoas() {
  try {
    const svg = await (await fetch('pessoas.html')).text();
    document.body.insertAdjacentHTML('afterbegin', svg);
    for (const u of document.querySelectorAll('.pessoa use')) {
      const alvo = u.getAttribute('href');
      u.removeAttribute('href');
      u.setAttribute('href', alvo);
    }
  } catch {
    // Sem as ilustracoes o deck continua legivel. Nao vale travar a oficina.
  }
}

(async () => {
  await carregarPessoas();
  try {
    const dados = await (await fetch('/api/steps')).json();
    passos = Object.fromEntries(dados.steps.map((s) => [s.id, s]));
    // Sem gravacao nenhuma, LIVE e a unica opcao possivel.
    if (dados.steps.some((s) => s.gravado)) ui.modo.title = 'gravações disponíveis';
  } catch {
    linha('erro', 'runner não encontrado — inicie com: node deck/runner.mjs');
  }
  ui.modo.className = 'pill live';
  conectar();
  mostrar(Number(location.hash.slice(1)) - 1 || 0);
})();
