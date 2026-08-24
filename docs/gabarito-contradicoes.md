# Gabarito — o que está plantado nas evidências

> **Uso interno do palestrante.** Não abrir na tela durante a oficina, e não incluir no contexto do agente.

O exercício foi construído de modo que as evidências **discordem entre si**. O agente não pode resolver a integração lendo um documento só — é isso que torna a spec necessária. Cada item abaixo é um ponto onde o método precisa produzir uma pergunta ou uma decisão registrada, e não uma escolha silenciosa.

---

## 1. O CPF — a contradição principal

Quatro fontes, autoridade crescente, e só a última diz a verdade.

| Fonte | Afirma | Autoridade percebida |
|---|---|---|
| Ata de kickoff, 14:08:15 (RA) | "Todo paciente tem CPF cadastrado, é regra do cadastro" | Alta — gerente de produto, fala com convicção |
| Requisitos, P-01 e RF-02 | CPF como chave de identificação | Alta — documento formal |
| Dicionário de dados, `nr_cpf` | **Obrigatório: Sim** | Muito alta — documento do fornecedor |
| DDL (`V1__schema.sql`) | `nr_cpf VARCHAR(11)` — **nullable** | Definitiva |
| Dado real (200 registros) | **31 sem CPF (15,5%)** | Definitiva |

E o mais grave, que nenhum documento menciona:

> **7 pacientes (3,5%) não têm nem CPF nem CNS.** Não possuem nenhum identificador de negócio.

Confirmação ao vivo:

```bash
docker exec sigh-db psql -U sigh_app -d sigh -c "SELECT count(*) FILTER (WHERE nr_cpf IS NULL) sem_cpf, count(*) FILTER (WHERE nr_cpf IS NULL AND nr_cns IS NULL) sem_nenhum FROM sigh.paciente;"
```

**O que se espera do agente:** levantar a divergência, não escolher em silêncio. A decisão correta é usar `cd_paciente` como identificador lógico do recurso e tratar CPF e CNS como identificadores de negócio opcionais.

**A fala:** *"A ata errou, o requisito errou e o dicionário do fornecedor errou. Só o dado estava certo. Se a gente tivesse ido direto pro código, esse bug estreava em produção — e em identificação de paciente isso é prontuário trocado."*

---

## 2. `tp_sexo = 'I'` — o valor que não existe na documentação

- Dicionário de dados e manual da API documentam apenas `M` e `F`
- `de_para_dominio` cadastra apenas `M` e `F` — e o seed traz um comentário explícito de que `I` não está lá
- O dado tem **6 registros (3%) com `I`**
- A nota de campo do anexo do manual da API entrega a origem: veio da migração do Hospnet em 2013, e *"ninguém sabe dizer se é 'ignorado' ou 'indeterminado'"*

**Decisão que a spec precisa registrar:** `I` mapeia para `unknown` ou para `other` em `Patient.gender`? São coisas diferentes. `unknown` = não se sabe; `other` = sabe-se que não é male/female. Sem informação, `unknown` é a escolha defensável — e precisa ficar escrito por quê.

---

## 3. `dt_atualizacao` — a sincronização que não fecha

- RF-07 exige sincronização incremental
- Wellington afirma em ata que a trigger preenche o campo, mas depois admite duas exceções: carga histórica e processo batch que escreve direto no banco
- Diego contesta na hora: *"Então eu não posso confiar em `dt_atualizacao`"*
- Dicionário de dados marca o campo como **Obrigatório: Sim**
- Dado real: **14 registros (7%) com `dt_atualizacao` nula**
- Manual da API, 4.3: *"Registros com `dt_atualizacao` nula nunca aparecem neste serviço"*

**Consequência:** um consumidor que sincroniza por `_lastUpdated` **nunca verá** esses 7%. A spec precisa registrar o risco e a mitigação (varredura completa periódica, ou `COALESCE(dt_atualizacao, dt_cadastro)`).

---

## 4. Inativo ≠ óbito

- Cláudia levanta explicitamente em ata, 14:14:40: *"Já vi integração tratar inativo como falecido e isso é gravíssimo"*
- `st_ativo = 'N'` → `Patient.active = false`
- `dt_obito` → `Patient.deceasedDateTime`
- São campos independentes. Há registro inativo sem óbito e a recíproca é possível

**Armadilha:** o agente pode colapsar os dois em um campo. A ata é a única fonte que avisa.

---

## 5. Nome social — obrigação legal, não preferência

- Ata, 14:11:12 — Decreto 8.727/2016, com reclamação de ouvidoria no histórico
- RF-06 exige precedência de exibição, mantendo o nome civil disponível
- Dicionário: campo existe desde 2019
- Manual da API: **nunca expôs o campo** — reforça a decisão de ir ao banco
- Dado real: 10 registros (5%) com nome social

**Mapeamento esperado:** `nm_social` → `Patient.name[use=usual]`, `nm_paciente` → `Patient.name[use=official]`. Quando não há nome social, só `official`.

---

## 6. Nome da mãe — restrição de LGPD contra conveniência técnica

- Diego quer para desambiguar homônimo (ata, 14:12:18)
- Paulo (DPO) barra: *"'É bom' não é finalidade"* → PD-03 restringe a campo não-padrão
- Dicionário marca como **Obrigatório: Sim**
- Dado real: 10 registros (5%) sem nome da mãe

**Decisão:** não incluir `nm_mae` no retorno padrão. É a única restrição do exercício que vem de fora da engenharia — e mostra que spec também carrega decisão jurídica.

---

## 7. Contradições menores (bons detalhes se sobrar tempo)

| Onde | O quê |
|---|---|
| Manual API §4.1 | `situacao` devolve `A`/`I`, banco usa `S`/`N` — de-para escondido dentro do próprio fornecedor |
| Manual API §3 | Charset declarado ISO-8859-1 sobre banco UTF-8 — acento corrompido |
| Manual API §4.2 | Parâmetro `nome` virou `termoBusca` na 4.2; doc é da 4.1 |
| Manual API §4.3 | Paginação quebrada acima de 1000 registros desde 2023, sem previsão |
| Manual API §4.4 | Endereço "previsto para 4.2" — encaminhamento #4 nunca respondido |
| Arquitetura §3.1 | FKs removidas em 2021 — nenhuma garantia de integridade referencial |
| Arquitetura §6 | Homologação em PG 17, produção em PG 12.14 |
| Dicionário, Nota 4 | Pode haver zero ou vários contatos com `st_principal = 'S'` |
| Dicionário, Nota 3 | Telefone em texto livre, seis formatos distintos no dado |
| Requisitos, comentários | Diego registra discordância formal — o conflito humano está documentado |

---

## Como conduzir o momento

1. Deixe o agente ler as evidências sem induzir nada
2. Quando ele levantar a questão do CPF, **pare a demo**
3. Rode a query na frente da plateia
4. Mostre os 3,5% sem nenhum identificador
5. Só então volte e deixe a decisão ser registrada na spec

O argumento inteiro da oficina cabe em uma frase:

> **A spec não é documentação do que foi feito. É o lugar onde a divergência aparece antes de virar código.**
