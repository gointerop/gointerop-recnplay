// Resolve o executavel do Claude Code de forma previsivel.
//
// No Windows, `claude` no PATH e um shim .cmd gerado pelo npm que repassa a
// chamada ao cmd.exe. Isso traz dois problemas para uma demo ao vivo:
//
//   1. exige spawn com shell:true, e ai os argumentos sao concatenados em vez
//      de escapados;
//   2. quando o executavel real some — auto-atualizacao interrompida deixa
//      apenas claude.exe.old.<timestamp> no diretorio bin — o erro que chega e
//      uma mensagem do cmd.exe sobre um caminho nao reconhecido, que nao diz
//      nada sobre a causa.
//
// Aqui o .exe real e localizado e chamado direto, sem shell no meio, e a falha
// vem com o motivo e o conserto.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const WINDOWS = process.platform === 'win32';
const CAMINHO_PACOTE = ['node_modules', '@anthropic-ai', 'claude-code', 'bin'];

/** Candidatos que o sistema conhece pelo nome `claude`. */
function candidatosNoPath() {
  try {
    return execFileSync(WINDOWS ? 'where' : 'which', ['claude'], { encoding: 'utf8' })
      .trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * A partir de um shim do npm, encontra o executavel real que ele chama.
 * Devolve tambem o caso em que so restou o arquivo .old, que e o sintoma de
 * atualizacao interrompida.
 */
function executavelDoPacote(shim) {
  const bin = join(dirname(shim), ...CAMINHO_PACOTE);
  if (!existsSync(bin)) return null;

  const alvo = join(bin, WINDOWS ? 'claude.exe' : 'claude');
  if (existsSync(alvo)) return { caminho: alvo, quebrado: false };

  const sobras = readdirSync(bin).filter((f) => f.includes('.old.'));
  return sobras.length ? { caminho: null, quebrado: true, bin, sobras } : null;
}

/**
 * @returns {{comando: string, shell: boolean, origem: string}}
 * @throws {Error} com diagnostico e conserto quando nao ha executavel utilizavel
 */
export function resolverClaude() {
  if (process.env.CLAUDE_BIN) {
    if (!existsSync(process.env.CLAUDE_BIN)) {
      throw new Error(`CLAUDE_BIN aponta para um arquivo que nao existe:\n    ${process.env.CLAUDE_BIN}`);
    }
    return { comando: process.env.CLAUDE_BIN, shell: false, origem: 'CLAUDE_BIN' };
  }

  const candidatos = candidatosNoPath();

  // Um .exe direto no PATH dispensa qualquer intermediario.
  const direto = candidatos.find((c) => c.toLowerCase().endsWith('.exe'));
  if (direto) return { comando: direto, shell: false, origem: 'PATH' };

  let interrompido = null;
  for (const shim of candidatos) {
    const achado = executavelDoPacote(shim);
    if (achado?.caminho) return { comando: achado.caminho, shell: false, origem: 'pacote npm' };
    if (achado?.quebrado) interrompido = achado;
  }

  if (interrompido) {
    throw new Error(
      'A instalacao do Claude Code esta incompleta.\n\n'
      + `  Em ${interrompido.bin}\n`
      + `  ha apenas ${interrompido.sobras.join(', ')} — o executavel em si nao esta la.\n`
      + '  E o que sobra de uma auto-atualizacao interrompida.\n\n'
      + '  Conserto:\n'
      + '      npm install -g @anthropic-ai/claude-code@latest\n');
  }

  // Fora do Windows o nome no PATH costuma bastar.
  if (!WINDOWS && candidatos.length) {
    return { comando: candidatos[0], shell: false, origem: 'PATH' };
  }

  throw new Error(
    'O comando `claude` nao foi encontrado no PATH.\n\n'
    + '  Instale com:\n'
    + '      npm install -g @anthropic-ai/claude-code@latest\n\n'
    + '  Ou aponte o executavel explicitamente:\n'
    + '      CLAUDE_BIN=/caminho/para/claude node deck/runner.mjs\n');
}

/**
 * Confirma que o executavel responde. Devolve a versao, ou null se nao responder
 * — o que normalmente significa sessao de autenticacao expirada.
 */
export function versaoDoClaude(comando) {
  try {
    return execFileSync(comando, ['--version'], { encoding: 'utf8', timeout: 20000 }).trim();
  } catch {
    return null;
  }
}
