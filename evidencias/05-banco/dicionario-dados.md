# SIGH — Dicionário de Dados · Módulo Cadastro de Pacientes

**Medsys Sistemas Ltda.**
Documento MS-DIC-011 · Revisão 2 · **Março de 2019**
Modelo de dados versão 4.2.1

---

## Schema `sigh`

### Tabela `paciente`

Cadastro mestre de pacientes.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cd_paciente` | INTEGER | **Sim** (PK) | Código interno do paciente. Sequencial. Nunca reaproveitado. |
| `nm_paciente` | VARCHAR(120) | **Sim** | Nome civil completo, conforme documento de identificação. |
| `nm_social` | VARCHAR(120) | Não | Nome social. Campo incluído na versão 4.1 (2019) em atendimento ao Decreto 8.727/2016. |
| `dt_nascimento` | DATE | **Sim** | Data de nascimento. |
| `tp_sexo` | CHAR(1) | **Sim** | Sexo. Domínio `SEXO` na tabela `de_para_dominio`. |
| `nr_cpf` | VARCHAR(11) | **Sim** | CPF sem máscara, 11 dígitos. Validado pela aplicação no momento do cadastro. |
| `nr_cns` | VARCHAR(15) | Não | Cartão Nacional de Saúde, 15 dígitos. |
| `nm_mae` | VARCHAR(120) | **Sim** | Nome civil completo da mãe. Usado para desambiguação de homônimos. |
| `st_ativo` | CHAR(1) | **Sim** | Situação do cadastro. `S` = ativo, `N` = inativo. Padrão `S`. |
| `dt_obito` | DATE | Não | Data do óbito, quando informada. |
| `dt_cadastro` | TIMESTAMP | **Sim** | Data e hora da criação do registro. |
| `dt_atualizacao` | TIMESTAMP | **Sim** | Data e hora da última alteração. Mantida por trigger da aplicação. |

> **Nota 1** — O campo `nr_cpf` possui índice não único. A unicidade é garantida pela aplicação, não pelo banco.
>
> **Nota 2** — O campo `st_ativo` indica situação **administrativa** do cadastro. Um cadastro inativo pode corresponder a um paciente vivo (duplicidade, cadastro incorreto, solicitação do titular). **Não confundir com óbito**, que possui campo próprio (`dt_obito`).

### Tabela `paciente_contato`

Telefones e endereços eletrônicos.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cd_contato` | INTEGER | **Sim** (PK) | Código do contato. |
| `cd_paciente` | INTEGER | **Sim** | Código do paciente. Sem FK declarada. |
| `tp_contato` | CHAR(3) | **Sim** | Domínio `TP_CONTATO`. Valores: `RES`, `CEL`, `COM`, `EML`. |
| `ds_contato` | VARCHAR(120) | **Sim** | Conteúdo do contato. **Texto livre, sem normalização de formato.** |
| `st_principal` | CHAR(1) | Não | `S` indica o contato principal. Padrão `N`. |

> **Nota 3** — O campo `ds_contato` é preenchido pela recepção sem máscara nem validação. Telefones aparecem em múltiplos formatos: `(81) 99999-9999`, `81999999999`, `+55 81 999999999`, `81-9999-9999`. Qualquer consumidor precisa normalizar.
>
> **Nota 4** — Não há garantia de que exista exatamente um contato com `st_principal = 'S'`. Pode haver nenhum ou mais de um.

### Tabela `paciente_endereco`

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cd_endereco` | INTEGER | **Sim** (PK) | Código do endereço. |
| `cd_paciente` | INTEGER | **Sim** | Código do paciente. Sem FK declarada. |
| `ds_logradouro` | VARCHAR(150) | **Sim** | Tipo e nome do logradouro, em campo único. |
| `nr_numero` | VARCHAR(10) | Não | Número. Campo texto — aceita `S/N`. |
| `ds_complemento` | VARCHAR(60) | Não | Complemento. |
| `nm_bairro` | VARCHAR(80) | Não | Bairro. |
| `cd_municipio_ibge` | INTEGER | Não | Código IBGE do município, 7 dígitos. |
| `sg_uf` | CHAR(2) | Não | Sigla da unidade federativa. |
| `nr_cep` | VARCHAR(8) | Não | CEP sem máscara. |
| `st_principal` | CHAR(1) | Não | `S` indica o endereço principal. |

### Tabela `municipio_ibge`

Subconjunto da tabela de municípios do IBGE, carregado na implantação.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cd_municipio_ibge` | INTEGER | **Sim** (PK) | Código IBGE de 7 dígitos. |
| `nm_municipio` | VARCHAR(80) | **Sim** | Nome do município. |
| `sg_uf` | CHAR(2) | **Sim** | Sigla da UF. |

> **Nota 5** — Esta tabela **não é atualizada automaticamente**. Municípios criados após a implantação podem não constar.

### Tabela `de_para_dominio`

Domínios internos do sistema, mantidos manualmente pela equipe do fornecedor.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cd_dominio` | VARCHAR(20) | **Sim** (PK) | Identificador do domínio. |
| `cd_valor` | VARCHAR(10) | **Sim** (PK) | Valor armazenado na coluna de origem. |
| `ds_valor` | VARCHAR(60) | **Sim** | Descrição legível. |

**Domínios cadastrados:**

| Domínio | Valor | Descrição |
|---|---|---|
| `SEXO` | `M` | Masculino |
| `SEXO` | `F` | Feminino |
| `TP_CONTATO` | `RES` | Telefone residencial |
| `TP_CONTATO` | `CEL` | Telefone celular |
| `TP_CONTATO` | `COM` | Telefone comercial |
| `TP_CONTATO` | `EML` | E-mail |
| `ST_ATIVO` | `S` | Ativo |
| `ST_ATIVO` | `N` | Inativo |

---

## Histórico de alterações do modelo

| Versão | Data | Alteração |
|---|---|---|
| 4.0 | 2013-06 | Modelo inicial, migração do Hospnet |
| 4.1 | 2019-03 | Inclusão de `paciente.nm_social` |
| 4.2 | 2021-08 | Inclusão de `paciente.dt_obito` |
| 4.2.1 | 2019-11 → 2021-10 | Remoção das constraints de integridade referencial das tabelas filhas por questão de performance |

---

## Consultas de apoio

**Localizar paciente por CPF**

```sql
SELECT * FROM sigh.paciente WHERE nr_cpf = '52998224725';
```

**Paciente com contatos e endereço principal**

```sql
SELECT p.cd_paciente, p.nm_paciente, p.nm_social,
       c.tp_contato, c.ds_contato,
       e.ds_logradouro, e.nr_numero, e.nm_bairro, e.sg_uf, e.nr_cep
  FROM sigh.paciente p
  LEFT JOIN sigh.paciente_contato  c ON c.cd_paciente = p.cd_paciente
  LEFT JOIN sigh.paciente_endereco e ON e.cd_paciente = p.cd_paciente
                                    AND e.st_principal = 'S'
 WHERE p.cd_paciente = 10001;
```

**Alterados desde uma data**

```sql
SELECT * FROM sigh.paciente
 WHERE dt_atualizacao > '2026-01-01'
 ORDER BY dt_atualizacao;
```
