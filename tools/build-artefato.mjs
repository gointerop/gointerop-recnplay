#!/usr/bin/env node
// Gera um arquivo unico e autocontido do deck, para compartilhar.
//
//   node tools/build-artefato.mjs
//
// Sai em dist/deck-artefato.html: HTML, CSS, SVG, logo e gravacoes num arquivo
// so, sem depender de servidor nem de rede.
//
// O artefato e SO REPLAY. O modo ao vivo dispara o Claude Code por um servidor
// local, o que uma pagina compartilhada nao faz -- e nem deveria.
//
// As gravacoes entram pre-renderizadas: dos 3,9 MB de stream-json, so cerca de
// 1,8% vira pixel na tela. O resto sao eventos de stream parcial que o painel
// descarta. Guardar so o que aparece leva o embutido a menos de 80 KB.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...partes) => resolve(ROOT, ...partes);
const ler = (...partes) => readFileSync(p(...partes), 'utf8');

// --------------------------------------------------------- gravacoes --
const RAIZES = ['fhir-facade', 'openspec', 'evidencias', 'legacy-db', 'deck', 'docs', 'tools'];

function encurtarCaminhos(texto) {
  return texto.replace(/[A-Za-z]:[\\/][^\s"']+|\/[^\s"']{12,}/g, (caminho) => {
    const partes = caminho.split(/[\\/]/);
    const raiz = partes.findIndex((x) => RAIZES.includes(x));
    if (raiz >= 0) return partes.slice(raiz).join('/');
    return partes.length > 3 ? '…/' + partes.slice(-2).join('/') : caminho;
  });
}

/**
 * Reduz o stream-json ao que o painel de fato desenha.
 *
 * Cada item vira uma tupla curta: ['t', texto] para fala do agente,
 * ['f', ferramenta, argumento] para chamada, ['r', minutos] para o fim.
 */
function prerenderizar() {
  const gravacoes = {};
  const arquivos = readdirSync(p('deck/recordings')).filter((f) => f.endsWith('.jsonl')).sort();

  for (const arquivo of arquivos) {
    const id = arquivo.slice(5, 7);
    const itens = [];
    for (const linha of ler('deck/recordings', arquivo).split('\n')) {
      if (!linha.trim()) continue;
      let ev;
      try { ev = JSON.parse(linha); } catch { continue; }

      if (ev.type === 'assistant') {
        for (const c of ev.message?.content ?? []) {
          if (c.type === 'text' && c.text.trim()) {
            itens.push(['t', encurtarCaminhos(c.text.trim())]);
          } else if (c.type === 'tool_use') {
            const i = c.input ?? {};
            const detalhe = i.command ?? i.file_path ?? i.pattern ?? i.path ?? i.prompt ?? '';
            itens.push(['f', c.name, encurtarCaminhos(String(detalhe).replace(/\s+/g, ' ')).slice(0, 160)]);
          }
        }
      } else if (ev.type === 'result') {
        itens.push(['r', Math.round(((ev.duration_ms ?? 0) / 60000) * 10) / 10]);
      }
    }
    gravacoes[id] = itens;
  }
  return gravacoes;
}

// ------------------------------------------------------ script do deck --
/**
 * Versao do deck.js para o artefato: navegacao, fragmentos, mapa, escada e
 * REPLAY a partir do dado embutido. Sem SSE, sem fetch, sem runner.
 *
 * Ganha o que uma pagina compartilhada precisa e o deck de palco nao: avanco
 * por clique e por gesto, para quem abrir no celular.
 */
function scriptDoArtefato(gravacoes, passos, certificacoes) {
  return `
const GRAVACOES = ${JSON.stringify(gravacoes).replace(/</g, '\\u003c')};
const PASSOS = ${JSON.stringify(passos).replace(/</g, '\\u003c')};
const CERT = ${JSON.stringify(certificacoes).replace(/</g, '\\u003c')};

const slides = [...document.querySelectorAll('.slide')];
const palco = document.getElementById('palco');
const fluxo = document.getElementById('fluxo');
const arvore = document.getElementById('arquivos');
const ui = {
  titulo: document.getElementById('painel-titulo'),
  estado: document.getElementById('painel-estado'),
  bloco: document.getElementById('rodape-bloco'),
  hora: document.getElementById('rodape-hora'),
  n: document.getElementById('rodape-n'),
  total: document.getElementById('rodape-total'),
  progresso: document.getElementById('progresso'),
  ajuda: document.getElementById('ajuda'),
};

let atual = 0, fragmento = 0, tocando = null;
ui.total.textContent = slides.length;

const fragmentosDe = (s) => Number(s.dataset.fragmentos ?? 0);

function mostrar(i, entrada = 'inicio') {
  atual = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => s.classList.toggle('ativo', k === atual));
  const slide = slides[atual];
  fragmento = entrada === 'fim' ? fragmentosDe(slide) : 0;
  aplicarFragmento();
  palco.classList.toggle('com-painel', Boolean(slide.dataset.step));
  if (slide.dataset.step) {
    const passo = PASSOS.find((x) => x.id === slide.dataset.step);
    ui.titulo.textContent = passo ? \`passo \${passo.id} — \${passo.title}\` : '';
  }
  ui.bloco.textContent = slide.dataset.bloco ?? '';
  ui.hora.textContent = slide.dataset.hora ?? '';
  ui.n.textContent = atual + 1;
  ui.progresso.style.width = \`\${((atual + 1) / slides.length) * 100}%\`;
  location.hash = String(atual + 1);
}

function aplicarFragmento() {
  const slide = slides[atual];
  slide.dataset.fragmento = String(fragmento);
  if (slide.dataset.mapa !== undefined) desenharNivel(fragmento);
  if (slide.dataset.escada !== undefined) acenderDegrau(slide, fragmento);
}

function acenderDegrau(slide, ate) {
  for (const d of slide.querySelectorAll('.degrau')) {
    const n = Number(d.dataset.degrau);
    d.classList.toggle('atual', n === ate);
    d.classList.toggle('aceso', n < ate);
  }
}

const avancar = () => fragmento < fragmentosDe(slides[atual])
  ? (fragmento++, aplicarFragmento()) : mostrar(atual + 1);
const recuar = () => fragmento > 0
  ? (fragmento--, aplicarFragmento()) : mostrar(atual - 1, 'fim');

// ------------------------------------------------------------ painel --
function anexar(el) {
  const noFim = fluxo.scrollHeight - fluxo.scrollTop - fluxo.clientHeight < 60;
  fluxo.append(el);
  if (noFim) fluxo.scrollTop = fluxo.scrollHeight;
}

function linha(classe, texto) {
  const el = document.createElement('div');
  el.className = classe; el.textContent = texto;
  anexar(el); return el;
}

function ferramenta(nome, arg) {
  const el = document.createElement('div');
  el.className = 'ferramenta';
  const n = document.createElement('span'); n.className = 'nome'; n.textContent = nome;
  const a = document.createElement('span'); a.className = 'arg'; a.textContent = arg;
  el.append(n, a); anexar(el);
}

const vistos = new Set();
function registrarArquivo(caminho) {
  if (!caminho || vistos.has(caminho) || !/^[a-z-]+\\//.test(caminho)) return;
  vistos.add(caminho);
  if (arvore.querySelector('.vazio')) arvore.replaceChildren();
  const el = document.createElement('div');
  el.className = 'no novo';
  const nome = document.createElement('span');
  nome.textContent = caminho;
  el.append(nome); arvore.append(el);
  arvore.scrollTop = arvore.scrollHeight;
}

function limpar() {
  fluxo.replaceChildren();
  vistos.clear();
  arvore.replaceChildren(Object.assign(document.createElement('div'),
    { className: 'vazio', textContent: 'os arquivos aparecem aqui conforme nascem' }));
}

/** Reproduz a gravacao do passo do slide atual. */
function reproduzir() {
  const id = slides[atual].dataset.step;
  if (!id) return;
  if (tocando) { clearTimeout(tocando); tocando = null; ui.estado.hidden = true; return; }
  const itens = GRAVACOES[id];
  if (!itens?.length) return linha('erro', 'sem gravação para este passo');

  limpar();
  const passo = PASSOS.find((x) => x.id === id);
  linha('aviso', \`▌ passo \${id} — \${passo?.title ?? ''}  [REPLAY]\`);
  ui.estado.hidden = false;

  let i = 0;
  const passar = () => {
    if (i >= itens.length) { tocando = null; ui.estado.hidden = true; return; }
    const item = itens[i++];
    if (item[0] === 't') linha('texto', item[1]);
    else if (item[0] === 'f') { ferramenta(item[1], item[2]); registrarArquivo(item[2]); }
    else linha('fim', \`concluído em \${item[1]} min\`);
    tocando = setTimeout(passar, item[0] === 't' ? 900 : 260);
  };
  tocando = setTimeout(passar, 250);
}

// -------------------------------------------------------------- mapa --
const proj = (lat, lon) => ({ x: (lon + 118) * 5, y: (33 - lat) * 5 });
function prng(s0) {
  let s = s0 >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const semear = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function montarMapa() {
  const alvo = document.getElementById('mapa-pontos');
  if (!alvo) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (const pais of CERT.paises) {
    const pontos = [];
    if (pais.destaque) pontos.push({ ...proj(pais.destaque.lat, pais.destaque.lon), rotulo: pais.destaque.cidade });
    const base = proj(pais.lat, pais.lon), r = prng(semear(pais.pais));
    const maximo = Math.max(...Object.values(pais.contagens));
    while (pontos.length < maximo) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      pontos.push({ x: base.x + Math.cos(a) * d * pais.raioX, y: base.y + Math.sin(a) * d * pais.raioY });
    }
    pontos.forEach((pt, ordem) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
      c.setAttribute('r', pt.rotulo ? 7 : 5);
      c.setAttribute('class', 'ponto' + (pt.rotulo ? ' destaque' : ''));
      c.dataset.pais = pais.pais; c.dataset.ordem = String(ordem);
      alvo.append(c);
    });
  }
  const fonte = document.getElementById('mapa-fonte');
  if (fonte) {
    fonte.textContent = \`\${CERT.fonte}, consultado em \${CERT.consultadoEm.split('-').reverse().join('/')}. \`
      + \`Países consultados: \${CERT.paises.map((x) => x.pais).join(', ')}.\`;
  }
  desenharNivel(0);
}

function desenharNivel(indice) {
  const nivel = CERT.niveis[Math.min(indice, CERT.niveis.length - 1)];
  let total = 0;
  for (const c of document.querySelectorAll('#mapa-pontos .ponto')) {
    const pais = CERT.paises.find((x) => x.pais === c.dataset.pais);
    const visivel = Number(c.dataset.ordem) < pais.contagens[nivel.id];
    c.classList.toggle('oculto', !visivel);
    if (visivel) total++;
  }
  const rotulo = document.getElementById('mapa-nivel');
  if (rotulo) rotulo.textContent = nivel.rotulo;
  const numero = document.getElementById('mapa-total');
  if (numero) numero.textContent = String(total);
  const nota = document.getElementById('mapa-nota');
  if (nota) { nota.textContent = nivel.nota ?? ''; nota.hidden = !nivel.nota; }
  document.getElementById('mapa-pontos')?.classList.toggle('final', Boolean(nivel.naoConstaNoDiretorio));
}

// --------------------------------------------------------- navegacao --
addEventListener('keydown', (e) => {
  if (e.key === '?') return ui.ajuda.classList.toggle('aberta');
  if (ui.ajuda.classList.contains('aberta') && e.key === 'Escape') return ui.ajuda.classList.remove('aberta');
  switch (e.key) {
    case 'ArrowRight': case ' ': case 'PageDown': avancar(); break;
    case 'ArrowLeft': case 'PageUp': recuar(); break;
    case 'Home': mostrar(0); break;
    case 'End': mostrar(slides.length - 1); break;
    case 's': case 'S': reproduzir(); break;
    case 'l': case 'L': limpar(); break;
    case 'Escape': if (tocando) { clearTimeout(tocando); tocando = null; ui.estado.hidden = true; } break;
  }
});

// Clique e gesto: quem abre um link compartilhado costuma estar sem teclado.
addEventListener('click', (e) => {
  if (e.target.closest('#painel, #ajuda, a, button')) return;
  if (ui.ajuda.classList.contains('aberta')) return ui.ajuda.classList.remove('aberta');
  (e.clientX < innerWidth * 0.25 ? recuar : avancar)();
});

let toqueX = null;
addEventListener('touchstart', (e) => { toqueX = e.changedTouches[0].clientX; }, { passive: true });
addEventListener('touchend', (e) => {
  if (toqueX === null) return;
  const d = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(d) > 45) (d < 0 ? avancar : recuar)();
  toqueX = null;
}, { passive: true });

montarMapa();
mostrar(Number(location.hash.slice(1)) - 1 || 0);

// A dica de navegacao some sozinha; quem abriu o link nao tem o roteiro.
setTimeout(() => document.getElementById('dica')?.classList.add('sumindo'), 6500);
`;
}

// ---------------------------------------------------------- montagem --
const gravacoes = prerenderizar();
const passos = JSON.parse(ler('deck/steps.json')).steps.map((s) => ({ id: s.id, title: s.title }));
const certificacoes = JSON.parse(ler('deck/certificacoes.json'));

const logo = readFileSync(p('deck/assets/logotipo-gointerop.png')).toString('base64');
const simbolos = ler('deck/pessoas.html')
  .replace(/<!--[\s\S]*?-->/g, '')
  .match(/<svg[\s\S]*<\/svg>/)[0];

let html = ler('deck/index.html');

// Tudo passa a viver dentro do proprio arquivo.
html = html.replace('<link rel="stylesheet" href="deck.css">', `<style>\n${ler('deck/deck.css')}\n</style>`);
html = html.replace('<script src="deck.js"></script>',
  `<script>\n${scriptDoArtefato(gravacoes, passos, certificacoes)}\n</script>`);
html = html.replace(/src="assets\/logotipo-gointerop\.png"/g, `src="data:image/png;base64,${logo}"`);
html = html.replace('<div id="palco">', `${simbolos}\n\n<div id="palco">`);

// No artefato o titulo vira o nome da pagina na galeria: so o nome, sem sufixo.
html = html.replace(/<title>[^<]*<\/title>/, '<title>Descomplicando o FHIR</title>');

// Ajuda e dica proprias do artefato: aqui nao existe modo ao vivo.
html = html.replace(
  '      <dt>S</dt><dd>disparar o passo deste slide</dd>\n      <dt>R</dt><dd>alternar entre LIVE e REPLAY</dd>',
  '      <dt>S · clique no painel</dt><dd>reproduzir o passo deste slide</dd>');
html = html.replace('<span class="pill" id="painel-modo">LIVE</span>',
  '<span class="pill replay" id="painel-modo">REPLAY</span>');

html = html.replace('</body>', `
<div id="dica">
  <strong>Prévia da oficina.</strong>
  <span><kbd>→</kbd> avança · <kbd>←</kbd> volta · <kbd>S</kbd> reproduz a demo · <kbd>?</kbd> ajuda</span>
  <span class="fraco">Ou toque na tela. As demonstrações rodam gravadas.</span>
</div>
<style>
#dica {
  position: fixed; left: 50%; bottom: 2.2rem; transform: translateX(-50%);
  z-index: 20; display: flex; gap: .55rem; align-items: center; flex-wrap: wrap;
  justify-content: center; max-width: min(92vw, 760px);
  padding: .6rem 1.2rem; border-radius: 999px;
  background: rgba(3, 17, 46, .93); border: 1px solid var(--card-line);
  color: var(--muted); font-size: .82rem; text-align: center;
  transition: opacity .8s ease, transform .8s ease;
}
#dica strong { color: var(--cyan-400); font-weight: 700; }
#dica .fraco { color: var(--dim); }
#dica.sumindo { opacity: 0; transform: translateX(-50%) translateY(8px); pointer-events: none; }
@media (prefers-reduced-motion: reduce) { #dica { transition: none; } }
</style>
</body>`);

mkdirSync(p('dist'), { recursive: true });
const saida = p('dist/deck-artefato.html');
writeFileSync(saida, html, 'utf8');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`\n  ${saida}`);
console.log(`  ${kb(Buffer.byteLength(html))}  ·  ${(html.match(/class="slide/g) || []).length} slides`);
console.log(`  gravacoes: ${Object.entries(gravacoes).map(([k, v]) => `${k}:${v.length}`).join(' ')}\n`);
