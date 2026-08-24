# Transcrição — Reunião de Kickoff Técnico

**Projeto:** Integração VitaFlow × Hospital Santa Aurora (SIGH / Medsys)
**Data:** 14/07/2026, 14h05 – 15h12
**Local:** Google Meet (gravado com consentimento dos participantes)
**Transcrição:** automática, revisada parcialmente

## Participantes

| Sigla | Nome | Papel |
|---|---|---|
| RA | Renata Albuquerque | Gerente de Produto — VitaFlow |
| DS | Diego Sampaio | Tech Lead — VitaFlow |
| CM | Cláudia Menezes | Coordenadora de TI — Hospital Santa Aurora |
| WB | Wellington Braga | Analista de Suporte N3 — Medsys (fornecedor do SIGH) |
| PR | Paulo Rezende | Encarregado de Dados (DPO) — Hospital Santa Aurora |

---

**[14:05:12] RA:** Pessoal, obrigada pelo tempo. Objetivo de hoje é sair com clareza do que a gente precisa pra ligar o VitaFlow no cadastro de pacientes de vocês. A gente não vai discutir agenda, não vai discutir prontuário, é só paciente. Se a gente resolver paciente, o resto destrava.

**[14:05:48] CM:** Perfeito. Só adiantando: a gente já passou por duas tentativas de integração aqui que morreram. Uma em 2022 com uma empresa de telemedicina e outra ano passado. As duas morreram no mesmo lugar, que é entender o cadastro.

**[14:06:20] DS:** Morreram como assim? Técnico ou contrato?

**[14:06:24] CM:** Técnico. A pessoa pegava a documentação da Medsys, fazia o de-para num Confluence, aí quando ia rodar com dado de verdade não batia. Aí voltava, refazia o de-para, não batia de novo. Terceira vez a diretoria cancelou.

**[14:06:51] WB:** Cláudia, com todo respeito, o problema ali foi que eles não usaram a API. Foram direto no banco.

**[14:07:02] CM:** Wellington, eles foram direto no banco porque a API não devolvia endereço.

**[14:07:08] WB:** Na versão 4.2 devolve.

**[14:07:11] CM:** A gente tá na 4.2.1.

**[14:07:14] WB:** [inaudível] ... eu vou checar isso.

**[14:07:29] RA:** Tá, vamos guardar isso como pendência. Diego, o que o VitaFlow precisa mesmo do paciente?

**[14:07:40] DS:** Precisamos identificar a pessoa com segurança e conseguir mostrar o básico na timeline: nome, data de nascimento, sexo, contato. Identificar é o crítico. Se eu errar a identificação eu misturo prontuário de duas pessoas, e aí é incidente grave.

**[14:08:15] RA:** Isso a gente resolve com CPF. Todo paciente tem CPF cadastrado, é regra do cadastro do hospital desde sempre. A gente casa por CPF e pronto.

**[14:08:29] CM:** É... é regra sim.

**[14:08:33] WB:** Olha, o campo `nr_cpf` no SIGH ele é... assim, ele não é obrigatório no banco não. Teve uma carga em 2013 quando migraram do sistema antigo que veio bastante coisa sem, e aí—

**[14:08:47] DS:** Wellington, desculpa cortar, mas quanto é "bastante"?

**[14:08:52] WB:** Rapaz, eu não tenho o número aqui. Mas é coisa antiga, paciente antigo. Hoje a recepção não deixa passar sem CPF.

**[14:09:03] RA:** Então na prática hoje todo mundo tem.

**[14:09:07] WB:** Hoje sim. O histórico eu não garanto.

**[14:09:12] RA:** Beleza, então a gente segue com CPF. Diego, anota aí: chave de identificação é CPF.

**[14:09:18] DS:** Anotado, mas eu quero ver os números antes de fechar isso. Cláudia, dá pra rodar um count no banco?

**[14:09:25] CM:** Dá. Me manda a query que eu rodo.

**[14:09:31] RA:** Ok, mas isso não pode travar o cronograma. A gente assume CPF e ajusta depois se precisar.

> **[NOTA DA TRANSCRIÇÃO]** — trecho de 14:09:40 a 14:11:05 com áudio degradado. Discussão sobre CNS. Recuperado parcialmente: WB menciona que "o CNS também tem, mas tem gente sem"; DS pergunta se dá pra usar CNS como alternativa; não há decisão registrada.

**[14:11:12] CM:** Uma coisa importante que aquelas outras integrações erraram: nome social. A gente tem obrigação legal, Decreto 8.727 de 2016, e o SIGH tem o campo separado. Se o app de vocês mostrar o nome de registro pra um paciente que tem nome social, a gente tem problema sério. Já tivemos reclamação na ouvidoria.

**[14:11:44] DS:** Entendi. Então o nome social tem precedência na exibição, mas o nome de registro continua existindo pra fins de documento.

**[14:11:52] CM:** Exato. Os dois têm que trafegar.

**[14:12:03] PR:** Deixa eu entrar aqui. Do ponto de vista de proteção de dados, eu preciso que a integração leve o mínimo necessário. Nome da mãe, por exemplo — vocês precisam de nome da mãe?

**[14:12:18] DS:** Nome da mãe é bom pra desambiguar homônimo, quando não tem documento.

**[14:12:25] PR:** "É bom" não é finalidade. Se a finalidade é desambiguação e vocês só usam quando não tem CPF, tudo bem, mas isso tem que estar escrito. Não pode ir no payload de todo mundo por padrão.

**[14:12:41] DS:** Justo. Anotado.

**[14:12:48] RA:** Paulo, e sobre o tipo de dado, tem alguma restrição de campo?

**[14:12:55] PR:** Dado de saúde é dado sensível, artigo 11 da LGPD. A base legal aqui é tutela da saúde. Isso cobre o que a gente precisa. Mas eu quero registrado quem acessa o quê. E não quero CPF em log nem em URL.

**[14:13:20] DS:** Isso é padrão pra gente.

**[14:13:32] RA:** Sobre sincronização — de quanto em quanto tempo o VitaFlow vai buscar atualização?

**[14:13:40] DS:** A ideia é buscar só o que mudou. Tem carimbo de atualização na tabela?

**[14:13:47] WB:** Tem, `dt_atualizacao`. É preenchido pela trigger da aplicação.

**[14:13:53] DS:** Sempre?

**[14:13:56] WB:** Quando altera pela tela, sim. A carga histórica... acho que veio nulo em parte. E tem processo batch que atualiza direto no banco e não passa pela trigger.

**[14:14:11] DS:** Então eu não posso confiar em `dt_atualizacao` pra sincronização incremental.

**[14:14:16] WB:** Pode confiar pro que é do dia a dia.

**[14:14:20] DS:** Isso não é a mesma coisa.

**[14:14:23] WB:** [risos] Não é não.

**[14:14:40] CM:** Outra coisa, e isso confunde todo mundo: a gente tem `st_ativo` e tem `dt_obito`. Não é a mesma coisa. `st_ativo` igual a N é cadastro desativado administrativamente — duplicidade, cadastro errado, paciente que pediu pra sair. Óbito é outra coisa, tem data própria. Já vi integração tratar inativo como falecido e isso é gravíssimo.

**[14:15:10] DS:** Ok, então são dois conceitos separados. Bom saber.

**[14:15:30] RA:** Wellington, a documentação da API que vocês mandaram, ela tá atualizada?

**[14:15:37] WB:** Ela é de... deixa eu ver... 2021. Tem coisa nova que não tá lá.

**[14:15:45] RA:** Tipo o quê?

**[14:15:48] WB:** O endpoint de busca por nome, por exemplo, mudou o parâmetro. E a paginação... a paginação tem um problema conhecido quando passa de mil registros. Tá aberto um chamado desde—

**[14:16:02] CM:** Desde 2023.

**[14:16:05] WB:** É.

**[14:16:20] DS:** Cláudia, existe a possibilidade de acesso direto ao banco, réplica somente leitura?

**[14:16:30] CM:** Existe. A gente já tem uma réplica que a BI usa. Dá pra criar um usuário read-only no schema `sigh`. Isso eu resolvo essa semana.

**[14:16:42] WB:** Eu recomendo formalmente que usem a API.

**[14:16:47] CM:** Wellington, registrado. Mas a réplica vai sair.

**[14:17:05] RA:** Vamos fechar então. Diego, resumo?

**[14:17:12] DS:** Resumindo: a gente expõe paciente num padrão de interoperabilidade, FHIR R4, em cima do banco do SIGH, sem migrar dado. Leitura por identificador, por nome, por data de nascimento. Nome social com precedência de exibição. Identificador... a gente ainda tem que fechar essa história de CPF.

**[14:17:38] RA:** CPF tá fechado.

**[14:17:41] DS:** Renata, eu preciso ver o dado.

**[14:17:45] RA:** Tá, vê o dado. Mas o plano é CPF.

**[14:18:02] CM:** Uma pergunta: por que FHIR e não um JSON qualquer nosso?

**[14:18:10] DS:** Porque se a gente inventar um JSON nosso, na terceira integração a gente tá com três JSONs diferentes. FHIR já resolveu esse problema, tem tipo, tem vocabulário, tem validador. E a RNDS é FHIR, então o dia que vocês precisarem notificar, já tá metade do caminho.

**[14:18:35] CM:** Isso é argumento forte pra diretoria. Anota isso.

**[14:19:00] RA:** Prazos. A gente tem demonstração pra board no fim de agosto. Precisa ter paciente funcionando.

**[14:19:15] DS:** Fim de agosto é apertado, mas dá se o escopo for só paciente mesmo.

**[14:19:22] RA:** É só paciente.

---

## Encaminhamentos

| # | Ação | Responsável | Prazo |
|---|---|---|---|
| 1 | Criar usuário read-only no schema `sigh` da réplica | Cláudia | 18/07 |
| 2 | Enviar DDL atualizado e dicionário de dados | Wellington | 18/07 |
| 3 | Rodar contagem de pacientes sem CPF e sem CNS | Cláudia | 21/07 |
| 4 | Confirmar se API 4.2.1 devolve endereço | Wellington | 21/07 |
| 5 | Documento de finalidade de uso de nome da mãe | Diego / Paulo | 25/07 |
| 6 | Definir estratégia de sincronização incremental | Diego | 25/07 |

## Observações da secretaria

- O encaminhamento **#3 não foi entregue até a data desta ata**. Cláudia informou por e-mail em 22/07 que a réplica estava em manutenção.
- O encaminhamento **#4 não foi respondido**.
- A decisão sobre chave de identificação foi registrada por RA como "CPF", com ressalva formal de DS em ata.
