#!/usr/bin/env node
// Gera os dados do banco legado SIGH de forma deterministica.
//
//   node tools/gen-seed.mjs
//
// Saidas:
//   legacy-db/migrations/V2__seed.sql
//   evidencias/05-banco/amostra-anonimizada.csv
//
// Os dados sao 100% sinteticos. Nenhum registro real de paciente foi usado.
// A distribuicao imita as imperfeicoes reais de um cadastro hospitalar antigo:
// CPF ausente em cadastros pre-2015, telefone em texto livre, endereco
// incompleto, nome social presente em parte da base.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOTAL = 200;
const SEED = 0x5eed_a17a;

// --- PRNG deterministico (mulberry32) --------------------------------------
let _s = SEED;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (a) => a[int(0, a.length - 1)];
const chance = (p) => rnd() < p;

// --- Pools de nomes --------------------------------------------------------
const PRE_F = ['Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana', 'Juliana', 'Márcia', 'Fernanda', 'Patrícia', 'Aline', 'Sandra', 'Camila', 'Amanda', 'Bruna', 'Jéssica', 'Letícia', 'Júlia', 'Luciana', 'Vanessa', 'Mariana', 'Gabriela', 'Vitória', 'Larissa', 'Cláudia', 'Rita', 'Débora', 'Simone', 'Cristiane'];
const PRE_M = ['José', 'João', 'Antônio', 'Francisco', 'Carlos', 'Paulo', 'Pedro', 'Lucas', 'Luiz', 'Marcos', 'Rafael', 'Daniel', 'Marcelo', 'Bruno', 'Eduardo', 'Felipe', 'Rodrigo', 'Gustavo', 'Thiago', 'André', 'Fábio', 'Ricardo', 'Sérgio', 'Vinícius', 'Matheus', 'Anderson', 'Severino', 'Cícero'];
const SOBRE = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Ribeiro', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Cavalcanti', 'Bezerra', 'Correia', 'Melo', 'Araújo', 'Duarte', 'Tavares'];

// --- Municipios (subconjunto real da tabela IBGE) ---------------------------
const MUNICIPIOS = [
  [2611606, 'Recife', 'PE'], [2607901, 'Jaboatão dos Guararapes', 'PE'],
  [2609600, 'Olinda', 'PE'], [2609402, 'Paulista', 'PE'],
  [2604106, 'Camaragibe', 'PE'], [2601052, 'Abreu e Lima', 'PE'],
  [2611101, 'São Lourenço da Mata', 'PE'], [2603454, 'Cabo de Santo Agostinho', 'PE'],
  [2607604, 'Igarassu', 'PE'], [2602902, 'Bezerros', 'PE'],
  [2604304, 'Caruaru', 'PE'], [2611408, 'Petrolina', 'PE'],
  [2609204, 'Palmares', 'PE'], [2610707, 'Salgueiro', 'PE'],
  [2704302, 'Maceió', 'AL'], [2507507, 'João Pessoa', 'PB'],
  [2408102, 'Natal', 'RN'], [2927408, 'Salvador', 'BA'],
];

const LOGRADOUROS = ['Rua', 'Avenida', 'Travessa', 'Praça', 'Estrada'];
const VIAS = ['do Sol', 'das Flores', 'Dom Bosco', 'Barão de Souza Leão', 'Conde da Boa Vista', 'Guararapes', 'Agamenon Magalhães', 'Frei Caneca', 'Beberibe', 'Real da Torre', 'Doutor José Maria', 'Padre Lemos', 'Sete de Setembro', 'Imperial', 'Benfica', 'Mascarenhas de Morais'];
const BAIRROS = ['Boa Viagem', 'Casa Amarela', 'Espinheiro', 'Torre', 'Madalena', 'Várzea', 'Afogados', 'Imbiribeira', 'Pina', 'Graças', 'Encruzilhada', 'Cordeiro', 'Iputinga', 'Santo Amaro', 'Bongi', 'Areias'];

// --- Documentos com digito verificador valido ------------------------------
function cpf() {
  const n = Array.from({ length: 9 }, () => int(0, 9));
  for (let k = 0; k < 2; k++) {
    const len = 9 + k;
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const d = ((sum * 10) % 11) % 10;
    n.push(d);
  }
  return n.join('');
}

function cns() {
  // CNS definitivo: comeca com 1 ou 2, 15 digitos, soma ponderada % 11 == 0.
  for (;;) {
    const base = String(pick([1, 2])) + Array.from({ length: 10 }, () => int(0, 9)).join('');
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += Number(base[i]) * (15 - i);
    let rest = sum % 11;
    let dv = 11 - rest;
    let result;
    if (dv === 11) dv = 0;
    if (dv === 10) {
      sum += 2;
      rest = sum % 11;
      dv = 11 - rest;
      if (dv === 11) dv = 0;
      result = base + '001' + dv;
    } else {
      result = base + '000' + dv;
    }
    if (result.length === 15) return result;
  }
}

// --- Telefone em texto livre (o ponto exato da bagunca) --------------------
function telefone(cel) {
  const ddd = pick(['81', '81', '81', '81', '82', '83', '84', '71']);
  const p = cel ? '9' + int(1000, 9999) : String(int(2000, 3999));
  const s = String(int(1000, 9999));
  return pick([
    `(${ddd}) ${p}-${s}`, `${ddd}${p}${s}`, `(${ddd})${p}${s}`,
    `${ddd} ${p}-${s}`, `+55 ${ddd} ${p}${s}`, `${ddd}-${p}-${s}`,
  ]);
}

const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const dt = (d) => d.toISOString().slice(0, 10);
const ts = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

// --- Geracao ---------------------------------------------------------------
const pacientes = [];
const contatos = [];
const enderecos = [];
let cdContato = 1;
let cdEndereco = 1;

for (let i = 0; i < TOTAL; i++) {
  const cd = 10001 + i;

  // 2% de registros com sexo indeterminado — o valor 'I' que a doc do
  // fornecedor nao explica.
  const tp = chance(0.02) ? 'I' : chance(0.52) ? 'F' : 'M';
  const fem = tp === 'F';
  const nome = `${pick(fem ? PRE_F : PRE_M)} ${pick(SOBRE)} ${pick(SOBRE)}`;
  const nmMae = `${pick(PRE_F)} ${pick(SOBRE)} ${pick(SOBRE)}`;

  // Cadastro antigo (pre-2015) frequentemente entrou sem CPF.
  const anoCadastro = int(2008, 2026);
  const antigo = anoCadastro < 2015;
  const semCpf = antigo ? chance(0.55) : chance(0.03);

  const nasc = new Date(Date.UTC(int(1930, 2024), int(0, 11), int(1, 28)));
  const cadastro = new Date(Date.UTC(anoCadastro, int(0, 11), int(1, 28), int(7, 20), int(0, 59)));
  // ~8% da carga historica ficou sem dt_atualizacao.
  const atualizacao = chance(0.08) ? null
    : new Date(Date.UTC(int(Math.max(anoCadastro, 2022), 2026), int(0, 11), int(1, 28), int(7, 20), int(0, 59)));

  const inativo = chance(0.06);
  const obito = inativo && chance(0.3);

  pacientes.push({
    cd,
    nm_paciente: nome,
    // Nome social presente em ~4% da base.
    nm_social: chance(0.04) ? `${pick([...PRE_F, ...PRE_M])} ${nome.split(' ').slice(1).join(' ')}` : null,
    dt_nascimento: chance(0.01) ? null : dt(nasc),
    tp_sexo: tp,
    nr_cpf: semCpf ? null : cpf(),
    // CNS ausente em ~18% dos cadastros.
    nr_cns: chance(0.18) ? null : cns(),
    nm_mae: chance(0.05) ? null : nmMae,
    st_ativo: inativo ? 'N' : 'S',
    dt_obito: obito ? dt(new Date(Date.UTC(int(2019, 2026), int(0, 11), int(1, 28)))) : null,
    dt_cadastro: ts(cadastro),
    dt_atualizacao: atualizacao ? ts(atualizacao) : null,
  });

  // Contatos: 0 a 3 por paciente.
  const nContatos = chance(0.07) ? 0 : int(1, 3);
  for (let c = 0; c < nContatos; c++) {
    const tipo = c === 0 ? 'CEL' : pick(['RES', 'CEL', 'COM', 'EML']);
    contatos.push({
      cd_contato: cdContato++,
      cd_paciente: cd,
      tp_contato: tipo,
      ds_contato: tipo === 'EML'
        ? `${nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${int(10, 99)}@exemplo.com.br`
        : telefone(tipo === 'CEL'),
      st_principal: c === 0 ? 'S' : 'N',
    });
  }

  // Enderecos: ~9% dos pacientes nao tem endereco cadastrado.
  if (!chance(0.09)) {
    const [ibge, , uf] = pick(MUNICIPIOS);
    enderecos.push({
      cd_endereco: cdEndereco++,
      cd_paciente: cd,
      ds_logradouro: `${pick(LOGRADOUROS)} ${pick(VIAS)}`,
      nr_numero: chance(0.06) ? 'S/N' : String(int(1, 2400)),
      ds_complemento: chance(0.35) ? `Apto ${int(101, 1204)}` : null,
      nm_bairro: pick(BAIRROS),
      cd_municipio_ibge: ibge,
      sg_uf: uf,
      // CEP faltando em ~14% dos enderecos.
      nr_cep: chance(0.14) ? null : String(int(50000000, 56999999)),
      st_principal: 'S',
    });
  }
}

// --- V2__seed.sql ----------------------------------------------------------
const L = [];
L.push("SET client_encoding = 'UTF8';");
L.push('');
L.push('-- =====================================================================');
L.push('-- SIGH — carga de dados de homologação');
L.push('-- Gerado por tools/gen-seed.mjs (determinístico, seed 0x5EEDA17A).');
L.push('-- 100% sintético. Nenhum dado real de paciente.');
L.push('-- =====================================================================');
L.push('');
L.push('-- Domínios internos do SIGH');
L.push("INSERT INTO sigh.de_para_dominio (cd_dominio, cd_valor, ds_valor) VALUES");
L.push("  ('SEXO', 'M', 'Masculino'),");
L.push("  ('SEXO', 'F', 'Feminino'),");
L.push("  ('TP_CONTATO', 'RES', 'Telefone residencial'),");
L.push("  ('TP_CONTATO', 'CEL', 'Telefone celular'),");
L.push("  ('TP_CONTATO', 'COM', 'Telefone comercial'),");
L.push("  ('TP_CONTATO', 'EML', 'E-mail'),");
L.push("  ('ST_ATIVO', 'S', 'Ativo'),");
L.push("  ('ST_ATIVO', 'N', 'Inativo');");
L.push('-- NOTA: o valor SEXO = I existe na base mas não está cadastrado aqui.');
L.push('');
L.push('-- Municípios');
L.push('INSERT INTO sigh.municipio_ibge (cd_municipio_ibge, nm_municipio, sg_uf) VALUES');
L.push(MUNICIPIOS.map(([c, n, u]) => `  (${c}, ${q(n)}, ${q(u)})`).join(',\n') + ';');
L.push('');
L.push('-- Pacientes');
L.push('INSERT INTO sigh.paciente (cd_paciente, nm_paciente, nm_social, dt_nascimento, tp_sexo, nr_cpf, nr_cns, nm_mae, st_ativo, dt_obito, dt_cadastro, dt_atualizacao) VALUES');
L.push(pacientes.map((p) => `  (${p.cd}, ${q(p.nm_paciente)}, ${q(p.nm_social)}, ${p.dt_nascimento ? q(p.dt_nascimento) : 'NULL'}, ${q(p.tp_sexo)}, ${q(p.nr_cpf)}, ${q(p.nr_cns)}, ${q(p.nm_mae)}, ${q(p.st_ativo)}, ${p.dt_obito ? q(p.dt_obito) : 'NULL'}, ${q(p.dt_cadastro)}, ${p.dt_atualizacao ? q(p.dt_atualizacao) : 'NULL'})`).join(',\n') + ';');
L.push('');
L.push('-- Contatos');
L.push('INSERT INTO sigh.paciente_contato (cd_contato, cd_paciente, tp_contato, ds_contato, st_principal) VALUES');
L.push(contatos.map((c) => `  (${c.cd_contato}, ${c.cd_paciente}, ${q(c.tp_contato)}, ${q(c.ds_contato)}, ${q(c.st_principal)})`).join(',\n') + ';');
L.push('');
L.push('-- Endereços');
L.push('INSERT INTO sigh.paciente_endereco (cd_endereco, cd_paciente, ds_logradouro, nr_numero, ds_complemento, nm_bairro, cd_municipio_ibge, sg_uf, nr_cep, st_principal) VALUES');
L.push(enderecos.map((e) => `  (${e.cd_endereco}, ${e.cd_paciente}, ${q(e.ds_logradouro)}, ${q(e.nr_numero)}, ${q(e.ds_complemento)}, ${q(e.nm_bairro)}, ${e.cd_municipio_ibge}, ${q(e.sg_uf)}, ${q(e.nr_cep)}, ${q(e.st_principal)})`).join(',\n') + ';');
L.push('');

mkdirSync(resolve(ROOT, 'legacy-db/migrations'), { recursive: true });
writeFileSync(resolve(ROOT, 'legacy-db/migrations/V2__seed.sql'), L.join('\n'), 'utf8');

// --- Amostra anonimizada em CSV (evidência entregue pelo fornecedor) --------
const amostra = pacientes.slice(0, 25);
const csv = [
  'cd_paciente;nm_paciente;nm_social;dt_nascimento;tp_sexo;nr_cpf;nr_cns;nm_mae;st_ativo;dt_obito;dt_atualizacao',
  ...amostra.map((p) => [
    p.cd, p.nm_paciente, p.nm_social ?? '', p.dt_nascimento ?? '', p.tp_sexo,
    p.nr_cpf ?? '', p.nr_cns ?? '', p.nm_mae ?? '', p.st_ativo,
    p.dt_obito ?? '', p.dt_atualizacao ?? '',
  ].join(';')),
].join('\n');

mkdirSync(resolve(ROOT, 'evidencias/05-banco'), { recursive: true });
writeFileSync(resolve(ROOT, 'evidencias/05-banco/amostra-anonimizada.csv'), csv, 'utf8');

// --- Relatório -------------------------------------------------------------
const semCpf = pacientes.filter((p) => !p.nr_cpf).length;
const semCns = pacientes.filter((p) => !p.nr_cns).length;
const semAmbos = pacientes.filter((p) => !p.nr_cpf && !p.nr_cns).length;
const sexoI = pacientes.filter((p) => p.tp_sexo === 'I').length;
const social = pacientes.filter((p) => p.nm_social).length;
const inativos = pacientes.filter((p) => p.st_ativo === 'N').length;
const semAtualizacao = pacientes.filter((p) => !p.dt_atualizacao).length;
const pct = (n) => `${((n / TOTAL) * 100).toFixed(1)}%`;

console.log(`pacientes ............ ${TOTAL}`);
console.log(`contatos ............. ${contatos.length}`);
console.log(`enderecos ............ ${enderecos.length}`);
console.log(`sem CPF .............. ${semCpf} (${pct(semCpf)})   <-- contradiz a ata`);
console.log(`sem CNS .............. ${semCns} (${pct(semCns)})`);
console.log(`sem CPF e sem CNS .... ${semAmbos} (${pct(semAmbos)})  <-- sem identificador de negocio`);
console.log(`tp_sexo = 'I' ........ ${sexoI} (${pct(sexoI)})       <-- fora do de_para_dominio`);
console.log(`com nome social ...... ${social} (${pct(social)})`);
console.log(`inativos ............. ${inativos} (${pct(inativos)})`);
console.log(`sem dt_atualizacao ... ${semAtualizacao} (${pct(semAtualizacao)})  <-- quebra busca por _lastUpdated`);
