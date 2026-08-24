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
let fragmento = 0;
let modo = 'live';
let rodando = null;
let inicio = 0;
let passos = {};

ui.total.textContent = slides.length;

// ------------------------------------------------------------ slides --

/** Quantos avancos o slide comporta antes de passar para o proximo. */
const fragmentosDe = (slide) => Number(slide.dataset.fragmentos ?? 0);

/**
 * @param {number} i indice do slide
 * @param {'inicio'|'fim'} entrada de que lado se entra — voltar para um slide
 *   com fragmentos precisa cair no ultimo, e nao no primeiro, senao a navegacao
 *   de tras para frente parece pular etapas.
 */
function mostrar(i, entrada = 'inicio') {
  atual = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => s.classList.toggle('ativo', k === atual));

  const slide = slides[atual];
  const step = slide.dataset.step;

  fragmento = entrada === 'fim' ? fragmentosDe(slide) : 0;
  aplicarFragmento();

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

function aplicarFragmento() {
  const slide = slides[atual];
  slide.dataset.fragmento = String(fragmento);
  if (slide.dataset.mapa !== undefined) desenharNivel(fragmento);
}

function avancar() {
  if (fragmento < fragmentosDe(slides[atual])) {
    fragmento++;
    aplicarFragmento();
  } else {
    mostrar(atual + 1);
  }
}

function recuar() {
  if (fragmento > 0) {
    fragmento--;
    aplicarFragmento();
  } else {
    mostrar(atual - 1, 'fim');
  }
}

// ------------------------------------------------------------ painel --

function limpar() {
  fluxo.replaceChildren();
  arvore.replaceChildren(Object.assign(document.createElement('div'),
    { className: 'vazio', textContent: 'os arquivos aparecem aqui conforme nascem' }));
}

/**
 * Acrescenta ao painel acompanhando o fim do stream — mas so enquanto o
 * palestrante nao tiver rolado para tras. Quem sobe para reler algo nao pode ser
 * puxado de volta a cada evento que chega.
 */
function anexar(el) {
  const noFim = fluxo.scrollHeight - fluxo.scrollTop - fluxo.clientHeight < 60;
  fluxo.append(el);
  if (noFim) fluxo.scrollTop = fluxo.scrollHeight;
}

function linha(classe, texto) {
  const el = document.createElement('div');
  el.className = classe;
  el.textContent = texto;
  anexar(el);
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
  anexar(el);
}

/** Diretorios de topo do projeto, usados para cortar o prefixo absoluto. */
const RAIZES = ['fhir-facade', 'openspec', 'evidencias', 'legacy-db', 'deck', 'docs', 'tools'];

/**
 * Encurta caminhos para exibicao.
 *
 * Caminho absoluto e ruido no projetor, e a gravacao do ensaio carrega o
 * diretorio onde ela foi feita — que nao e o da maquina do palco. Cortar no
 * primeiro diretorio conhecido do projeto resolve os dois casos.
 */
function encurtarCaminhos(texto) {
  return texto.replace(/[A-Za-z]:[\\/][^\s"']+|\/[^\s"']{12,}/g, (caminho) => {
    const partes = caminho.split(/[\\/]/);
    const raiz = partes.findIndex((p) => RAIZES.includes(p));
    if (raiz >= 0) return partes.slice(raiz).join('/');
    return partes.length > 3 ? '…/' + partes.slice(-2).join('/') : caminho;
  });
}

/** Traduz um evento do stream-json do Claude Code para o painel. */
function renderizarAgente(ev) {
  if (ev.type === 'assistant' && ev.message?.content) {
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text.trim()) {
        linha('texto', encurtarCaminhos(c.text.trim()));
      } else if (c.type === 'tool_use') {
        const i = c.input ?? {};
        const detalhe = i.command ?? i.file_path ?? i.pattern ?? i.path ?? i.prompt ?? '';
        ferramenta(c.name, encurtarCaminhos(String(detalhe).replace(/\s+/g, ' ')).slice(0, 160));
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
    fluxo.scrollTop = fluxo.scrollHeight;
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
    case 'ArrowRight': case ' ': case 'PageDown': avancar(); break;
    case 'ArrowLeft': case 'PageUp': recuar(); break;
    case 'Home': mostrar(0); break;
    case 'End': mostrar(slides.length - 1); break;
    case 's': case 'S': disparar(); break;
    case 'r': case 'R': alternarModo(); break;
    case 'l': case 'L': limpar(); break;
    case 'Escape': abortar(); break;
  }
});


// ------------------------------------------------------------- mapa --
/*
 * Mapa de certificacoes FHIR na America Latina.
 *
 * Os pontos sao gerados a partir de deck/certificacoes.json, e nao escritos no
 * HTML: quando chegarem os dados dos paises que faltam, basta acrescentar
 * entradas no JSON.
 */

let certificacoes = null;

/**
 * Projecao equirretangular, identica a usada para tracar a silhueta em
 * deck/pessoas.html. Mantendo a mesma formula nos dois lugares, os pontos caem
 * no lugar certo sem ajuste manual.
 */
const proj = (lat, lon) => ({ x: (lon + 118) * 5, y: (33 - lat) * 5 });

/** PRNG com semente, para que a dispersao dos pontos seja sempre a mesma. */
function prng(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semear = (texto) => [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

/**
 * Um ponto por profissional, do mais persistente para o menos.
 *
 * A ordem importa: no nivel N ficam visiveis os primeiros `contagem[N]` pontos
 * do pais. Como o ponto de destaque e sempre o primeiro, ele e o ultimo a
 * sobrar — e o mapa termina com Recife aceso.
 */
function pontosDoPais(pais) {
  const pontos = [];
  if (pais.destaque) {
    pontos.push({ ...proj(pais.destaque.lat, pais.destaque.lon), rotulo: pais.destaque.cidade });
  }
  const base = proj(pais.lat, pais.lon);
  const aleatorio = prng(semear(pais.pais));
  const maximo = Math.max(...Object.values(pais.contagens));
  while (pontos.length < maximo) {
    const angulo = aleatorio() * Math.PI * 2;
    const raio = Math.sqrt(aleatorio());
    pontos.push({
      x: base.x + Math.cos(angulo) * raio * pais.raioX,
      y: base.y + Math.sin(angulo) * raio * pais.raioY,
    });
  }
  return pontos;
}

async function montarMapa() {
  const alvo = document.getElementById('mapa-pontos');
  if (!alvo) return;

  try {
    certificacoes = await (await fetch('certificacoes.json')).json();
  } catch {
    linha('erro', 'não foi possível carregar certificacoes.json');
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  for (const pais of certificacoes.paises) {
    pontosDoPais(pais).forEach((ponto, ordem) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', ponto.x.toFixed(1));
      c.setAttribute('cy', ponto.y.toFixed(1));
      c.setAttribute('r', ponto.rotulo ? 7 : 5);
      c.setAttribute('class', 'ponto' + (ponto.rotulo ? ' destaque' : ''));
      c.dataset.pais = pais.pais;
      c.dataset.ordem = String(ordem);
      if (ponto.rotulo) c.dataset.cidade = ponto.rotulo;
      alvo.append(c);
    });
  }

  const fonte = document.getElementById('mapa-fonte');
  if (fonte) {
    const consulta = certificacoes.consultadoEm.split('-').reverse().join('/');
    fonte.textContent = `${certificacoes.fonte}, consultado em ${consulta}. `
      + `Países consultados: ${certificacoes.paises.map((p) => p.pais).join(', ')}.`;
  }

  desenharNivel(0);
}

/** Aplica o nivel correspondente ao fragmento atual. */
function desenharNivel(indice) {
  if (!certificacoes) return;
  const nivel = certificacoes.niveis[Math.min(indice, certificacoes.niveis.length - 1)];

  let total = 0;
  for (const c of document.querySelectorAll('#mapa-pontos .ponto')) {
    const pais = certificacoes.paises.find((p) => p.pais === c.dataset.pais);
    const visivel = Number(c.dataset.ordem) < pais.contagens[nivel.id];
    c.classList.toggle('oculto', !visivel);
    if (visivel) total++;
  }

  const rotulo = document.getElementById('mapa-nivel');
  if (rotulo) rotulo.textContent = nivel.rotulo;

  const numero = document.getElementById('mapa-total');
  if (numero) numero.textContent = String(total);

  const nota = document.getElementById('mapa-nota');
  if (nota) {
    nota.textContent = nivel.nota ?? '';
    nota.hidden = !nivel.nota;
  }

  document.getElementById('mapa-pontos')?.classList.toggle('final', Boolean(nivel.naoConstaNoDiretorio));
}

// ------------------------------------------------------------ inicio --

/**
 * Injeta os simbolos SVG: ilustracoes das personas e a silhueta do mapa.
 *
 * Ficam num arquivo separado para nao inchar o index.html, e sao injetadas em vez
 * de referenciadas por <use href="arquivo.svg#id">: o Chrome nao resolve <use>
 * para documento externo. Depois da injecao, os href sao reescritos para forcar a
 * re-resolucao dos <use> que ja estavam no DOM.
 */
async function carregarSvg() {
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
  await carregarSvg();
  await montarMapa();
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
