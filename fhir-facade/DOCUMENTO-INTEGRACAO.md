# Integração de Cadastro de Pacientes — SIGH → FHIR R4

| | |
|---|---|
| **De** | Equipe de integração VitaFlow |
| **Para** | Medsys Sistemas Ltda. · Coordenação de TI do Hospital Santa Aurora |
| **Assunto** | Fachada FHIR R4 somente leitura sobre o cadastro de pacientes do SIGH |
| **Versão** | 1.0 |
| **Referências** | Ata de kickoff 14/07/2026 · Requisitos VF-412 · Arquitetura v2.1 · MS-INT-004 rev.3 · MS-DIC-011 rev.2 |

> Este documento descreve o que foi construído, como o dado é lido e o que encontramos na base durante a implementação. A seção 4 registra divergências entre a documentação e o dado observado. Não é auditoria: é o levantamento que qualquer integração precisaria fazer, publicado para que a próxima não precise refazê-lo.

---

## 1. O que foi construído

Uma fachada que expõe o cadastro de pacientes do SIGH no padrão **HL7 FHIR R4**, como recurso `Patient`.

**Está no escopo:**

- Leitura de um paciente pelo código do cadastro
- Busca por documento (CPF ou CNS), por nome, por data de nascimento e por data de atualização
- Documentação navegável (Swagger UI) gerada a partir das capacidades do próprio servidor
- Validação de conformidade dos recursos produzidos

**Não está no escopo:**

- Qualquer escrita no SIGH
- Qualquer recurso além de `Patient` — sem agendamento, internação, prontuário ou faturamento
- Reconciliação de duplicidade ou índice mestre de pacientes
- Autenticação do consumidor, resolvida hoje pelo perímetro de rede

## 2. Como o dado é acessado

A fachada consulta a **réplica somente leitura** do PostgreSQL do SIGH, conforme decisão DA-01 registrada no documento de arquitetura.

| | |
|---|---|
| Origem | réplica `10.20.4.11:5432`, banco do SIGH, schema `sigh` |
| Usuário | `integracao_ro` |
| Privilégio | `SELECT` no schema `sigh`, e nada além disso |
| Escrita | nenhuma, por nenhum caminho |
| Cópia de dado | nenhuma — o recurso FHIR é montado em memória a cada requisição e descartado |

**Três garantias, em camadas independentes:**

1. O usuário do banco não tem privilégio de escrita. Uma tentativa falharia no servidor.
2. O pool de conexões é marcado como somente leitura. Uma tentativa falharia no driver, antes de chegar ao banco.
3. Nenhuma operação de escrita é declarada no servidor FHIR. O `CapabilityStatement` publica apenas `read`, `vread` e `search-type`, e o servidor recusa `create`, `update` e `delete`.

**Nenhum objeto do banco do SIGH foi criado ou alterado.** Nenhuma tabela, índice, view, trigger ou extensão. A restrição RA-02 foi respeitada integralmente — inclusive quando isso custou desempenho, como descrito em 6.3.

Uma única consulta com `LEFT JOIN` traz paciente, contatos, endereço e o nome do município. As junções são defensivas, porque as constraints de integridade referencial foram removidas da origem em 2021: a ausência de linha filha é tratada como caso normal.

## 3. Mapeamento SIGH → FHIR R4

### 3.1 Identificação

| Coluna do SIGH | Elemento FHIR | Regra |
|---|---|---|
| `paciente.cd_paciente` | `Patient.id` | Identificador lógico do recurso. Usado tal como está. |
| `paciente.nr_cpf` | `Patient.identifier` | System `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf`. Omitido quando nulo. |
| `paciente.nr_cns` | `Patient.identifier` | System `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns`. Omitido quando nulo. |

### 3.2 Identificação da pessoa

| Coluna do SIGH | Elemento FHIR | Regra |
|---|---|---|
| `paciente.nm_paciente` | `Patient.name` com `use = official` | Texto integral, sem divisão em nome e sobrenome. |
| `paciente.nm_social` | `Patient.name` com `use = usual` | Presente apenas quando há valor. Tem precedência de exibição. |
| `paciente.dt_nascimento` | `Patient.birthDate` | Data de calendário, sem conversão de fuso. Ver 6.1. |
| `paciente.tp_sexo` | `Patient.gender` | `M` → `male`, `F` → `female`, `I` → `unknown`, nulo → elemento omitido. |
| `paciente.nm_mae` | — | **Não trafega.** Ver 3.6. |

### 3.3 Situação

| Coluna do SIGH | Elemento FHIR | Regra |
|---|---|---|
| `paciente.st_ativo` | `Patient.active` | `S` → `true`, `N` → `false`. |
| `paciente.dt_obito` | `Patient.deceasedDateTime` | Presente apenas quando há valor. |

Os dois são **independentes**. Um cadastro inativo não é interpretado como óbito, conforme alertado pela coordenação de TI na reunião de 14/07.

### 3.4 Contatos

| Coluna do SIGH | Elemento FHIR | Regra |
|---|---|---|
| `paciente_contato.tp_contato = 'CEL'` | `telecom` com `system = phone`, `use = mobile` | |
| `paciente_contato.tp_contato = 'RES'` | `telecom` com `system = phone`, `use = home` | |
| `paciente_contato.tp_contato = 'COM'` | `telecom` com `system = phone`, `use = work` | |
| `paciente_contato.tp_contato = 'EML'` | `telecom` com `system = email` | Valor preservado como está. |
| `paciente_contato.ds_contato` | `telecom.value` | Telefone reduzido a dígitos; prefixo `55` de país removido. Ver 4.4. |

### 3.5 Endereço

| Coluna do SIGH | Elemento FHIR | Regra |
|---|---|---|
| `ds_logradouro` + `nr_numero` | `address.line[0]` | Concatenados com vírgula. Sem número, apenas o logradouro. |
| `ds_complemento` | `address.line[1]` | Omitido quando nulo. |
| `nm_bairro` | `address.district` | |
| `cd_municipio_ibge` → `municipio_ibge.nm_municipio` | `address.city` | Resolvido por junção. |
| `sg_uf` | `address.state` | |
| `nr_cep` | `address.postalCode` | Omitido quando nulo. |
| — | `address.country` | Fixo em `BR`. |

Quando há mais de um endereço marcado como principal — o que a Nota 4 do dicionário admite ser possível — vale o de menor `cd_endereco`. Sem nenhum principal, vale o de menor `cd_endereco` entre todos. A escolha é determinística: a mesma consulta devolve sempre o mesmo endereço.

### 3.6 Nome da mãe

A coluna `paciente.nm_mae` **não é lida pela integração**. Não aparece no recurso, não é aceita como parâmetro de busca e não é consultada em nenhum momento.

A decisão é do encarregado de dados do Hospital Santa Aurora, registrada como restrição PD-03: o uso pretendido — desambiguação de homônimos — não constitui finalidade declarada, e o princípio da minimização impede que o dado trafegue por conveniência.

A restrição é aplicada na própria consulta SQL, e não no código de conversão. O dado não chega a entrar no processo.

## 4. O que encontramos na base

Os números abaixo vêm da base de homologação de 200 registros, que preserva as distribuições de preenchimento da produção.

### 4.1 CPF não é obrigatório na prática

O dicionário MS-DIC-011 registra `nr_cpf` como **Obrigatório: Sim**. O DDL entregue permite nulo, e o dado confirma:

| | Registros | Proporção |
|---|---|---|
| Sem CPF | 31 | 15,5% |
| Sem CNS | 35 | 17,5% |
| **Sem CPF e sem CNS** | **7** | **3,5%** |

Os 3,5% sem nenhum documento são o ponto relevante: esses pacientes **não possuem identificador de negócio algum**. Nenhum dos documentos disponíveis menciona esse caso.

**Consequência para a integração:** o identificador lógico do recurso é `cd_paciente`, e não o CPF. CPF e CNS entram como identificadores de negócio opcionais. Uma integração que assumisse CPF como chave não conseguiria representar esses pacientes — ou, pior, os agruparia sob um valor nulo comum.

**Origem provável:** a nota de suporte da Medsys de 14/07 aponta a carga de migração do Hospnet, em 2013, como responsável pelos cadastros sem CPF.

### 4.2 O valor `I` em `tp_sexo`

O domínio `SEXO` da tabela `de_para_dominio` cadastra apenas `M` e `F`. O manual MS-INT-004 documenta apenas `M` e `F`. A base contém **6 registros (3%) com `tp_sexo = 'I'`**.

A nota de campo do suporte da Medsys registra que o valor veio da migração de 2013 e que não há registro do seu significado — se "ignorado" ou "indeterminado".

**Decisão adotada:** `I` mapeia para `unknown`. O código `other` do FHIR afirma que a pessoa não é masculino nem feminino, e não há evidência que sustente essa afirmação. `unknown` declara exatamente o que se sabe: não se sabe.

**Pedido:** a Medsys pode confirmar o significado original do valor? Se for "indeterminado", o mapeamento correto passa a ser `other`.

### 4.3 `dt_atualizacao` não sustenta sincronização incremental

O dicionário registra o campo como **Obrigatório: Sim**. A base contém **14 registros (7%) com `dt_atualizacao` nula**.

O suporte da Medsys confirmou em 14/07 que a trigger da aplicação não cobre dois casos: a carga histórica de 2013 e os processos batch que escrevem direto no banco.

O manual MS-INT-004, seção 4.3, documenta a consequência no próprio serviço do fornecedor: *registros com `dt_atualizacao` nula nunca aparecem* no endpoint de alterados.

**Mitigação adotada:** a fachada deriva `Patient.meta.lastUpdated` de `COALESCE(dt_atualizacao, dt_cadastro)`. Isso garante que todo registro tenha uma data efetiva e apareça em ao menos uma janela de sincronização.

**O que a mitigação não resolve:** se um processo batch alterar um registro sem atualizar o carimbo, a alteração permanece invisível à sincronização incremental. Ver 6.2.

### 4.4 Telefone sem formato

A Nota 3 do dicionário registra que `ds_contato` é texto livre. A base confirma ao menos seis formatos distintos para o mesmo tipo de número:

```
(81) 99999-9999      81999999999      (81)999999999
81 99999-9999        +55 81 999999999  81-9999-9999
```

A fachada normaliza para dígitos e remove o prefixo de país. O DDD `55`, de Caxias do Sul, é preservado: só há remoção quando o resultado tem 12 ou 13 dígitos.

### 4.5 Outras observações menores

| Documento | Observado |
|---|---|
| MS-INT-004 §4.1 | O campo `situacao` da API devolve `A`/`I`, enquanto `st_ativo` no banco usa `S`/`N`. Consumidores dos dois caminhos veem domínios diferentes. |
| MS-INT-004 §3 | O charset declarado é ISO-8859-1 e o banco é UTF-8. |
| MS-INT-004 §4.2 | O parâmetro `nome` foi renomeado para `termoBusca` na versão 4.2; a revisão 3 do manual não registra a mudança. |
| MS-INT-004 §4.4 | O serviço de endereço consta como "previsto para a 4.2". O hospital está na 4.2.1 e a disponibilidade não foi confirmada. |
| MS-DIC-011 | `dt_nascimento`, `nm_mae` e `dt_atualizacao` constam como obrigatórios; os três admitem nulo no DDL e têm nulos no dado. |

## 5. Verificação

| Verificação | Resultado |
|---|---|
| Conformidade FHIR R4 dos 200 pacientes da base | nenhum issue de severidade `error` ou `fatal` |
| Testes automatizados | 78, todos passando |
| Cobertura de código | 97,2% — o build quebra abaixo de 90% |
| Testes de integração | contra o schema real, aplicando as migrations do fornecedor |
| `CapabilityStatement` | publica apenas `read`, `vread` e `search-type` |
| Escrita | recusada nas três camadas descritas em 2 |

Os testes de integração aplicam **as migrations reais do SIGH**, e não uma cópia adaptada. Se uma atualização do SIGH alterar o modelo de dados, o build da integração quebra — em vez de a integração quebrar em produção.

## 6. Riscos em aberto

### 6.1 Acoplamento ao modelo de dados

A decisão DA-01 acopla a integração ao **modelo de dados** do SIGH, e não a um contrato de API. Renomear ou remover uma coluna quebra a fachada.

*Mitigação atual:* os testes de integração descritos em 5.
*O que ajudaria:* aviso prévio nas notas de versão sobre mudanças no schema do módulo de cadastro.

### 6.2 Sincronização incremental permanece incompleta

O `COALESCE` cobre o registro sem carimbo, mas não cobre a alteração que não atualiza o carimbo.

*Mitigação atual:* varredura completa periódica, além da incremental.
*O que resolveria:* uma trigger no nível do banco em `sigh.paciente`, alcançando também as escritas batch. Isso depende da Medsys — a restrição RA-02 nos impede de criá-la.

### 6.3 Busca por nome sem índice

A busca por nome é parcial e insensível a acentuação. Como a extensão `unaccent` exigiria alterar o banco, a dobra de acentos é feita com `translate` na consulta — o que impede o uso do índice `ix_paciente_nome`.

Na base de homologação, com 200 registros, é irrelevante. Em produção, com 480 mil, é varredura completa a cada busca por nome. O requisito RNF-04 pede 800 ms no percentil 95.

*O que resolveria:* um índice funcional sobre o nome dobrado, ou a extensão `unaccent`. Ambos dependem da Medsys.

### 6.4 Ausência de integridade referencial

Sem as constraints removidas em 2021, não há garantia contra contato órfão, endereço apontando para paciente inexistente ou município fora da tabela do IBGE.

*Mitigação atual:* toda junção é defensiva e toda escolha ambígua é determinística.
*Observação:* a tabela `municipio_ibge` não é atualizada automaticamente (Nota 5 do dicionário). Município criado após a implantação não resolve o nome, e `address.city` sai vazio.

### 6.5 Divergência entre homologação e produção

A homologação roda PostgreSQL 17 e a produção roda 12.14, que está fora do suporte da comunidade. Nenhum recurso posterior à versão 12 é usado na consulta, mas o ideal é alinhar as versões.

## 7. Resumo dos pedidos à Medsys

| # | Pedido | Motivo |
|---|---|---|
| 1 | Confirmar o significado original de `tp_sexo = 'I'` | Define se o mapeamento correto é `unknown` ou `other` (4.2) |
| 2 | Trigger de `dt_atualizacao` no nível do banco | Fecha o furo da sincronização incremental (6.2) |
| 3 | Índice funcional sobre o nome sem acentuação | Viabiliza o requisito de tempo de resposta (6.3) |
| 4 | Atualizar MS-DIC-011 quanto à obrigatoriedade real das colunas | Evita que a próxima integração repita o levantamento (4.1, 4.3) |
| 5 | Atualizar MS-INT-004 para a versão 4.2.1 | Parâmetro renomeado e endereço não confirmado (4.5) |
| 6 | Avisar mudanças de schema nas notas de versão | Reduz o risco de 6.1 |

---

**GOInterop** · [gointerop.com](https://gointerop.com) · contato@gointerop.com
