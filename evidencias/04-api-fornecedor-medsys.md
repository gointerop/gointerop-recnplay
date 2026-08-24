# SIGH — Manual de Integração · Módulo Cadastro

**Medsys Sistemas Ltda.**
Documento MS-INT-004 · Revisão 3 · **Novembro de 2021**
Aplicável às versões SIGH 4.0 e 4.1

> Este documento é propriedade da Medsys Sistemas Ltda. Distribuição restrita a clientes com contrato de suporte vigente.

---

## 1. Apresentação

O módulo de integração do SIGH disponibiliza serviços REST para consulta ao cadastro de pacientes. Os serviços são publicados pelo middleware de integração na porta 8480.

**URL base:** `http://<servidor-sigh>:8480/sigh-api`

## 2. Autenticação

Autenticação HTTP Basic. A credencial de serviço é fornecida pela Medsys no ato da implantação e é **compartilhada entre todos os integradores** do cliente.

```
Authorization: Basic <base64(usuario:senha)>
```

> **Observação de suporte (não constava na revisão 2):** a credencial não expira e não há rotação automática. Solicite troca por chamado.

## 3. Formato

Todas as respostas são em **XML**. O cabeçalho `Accept` é ignorado.

```
Content-Type: application/xml; charset=ISO-8859-1
```

> **Observação de suporte:** o charset declarado é ISO-8859-1, mas o banco é UTF-8. Há relatos de caracteres acentuados corrompidos em nomes. Contorno conhecido: reprocessar a resposta como UTF-8 ignorando o cabeçalho.

## 4. Serviços

### 4.1 Consultar paciente por código

```
GET /sigh-api/paciente/{codigo}
```

**Resposta**

```xml
<paciente>
  <codigo>10001</codigo>
  <nome>MARIA SILVA SANTOS</nome>
  <dataNascimento>1978-03-14</dataNascimento>
  <sexo>F</sexo>
  <cpf>52998224725</cpf>
  <cns>898004123456780</cns>
  <nomeMae>ANA SILVA</nomeMae>
  <situacao>A</situacao>
</paciente>
```

| Campo | Origem | Observação |
|---|---|---|
| `codigo` | `paciente.cd_paciente` | |
| `nome` | `paciente.nm_paciente` | retornado em caixa alta pelo serviço |
| `dataNascimento` | `paciente.dt_nascimento` | formato ISO |
| `sexo` | `paciente.tp_sexo` | ver seção 5 |
| `cpf` | `paciente.nr_cpf` | somente dígitos |
| `cns` | `paciente.nr_cns` | |
| `nomeMae` | `paciente.nm_mae` | |
| `situacao` | `paciente.st_ativo` | `A` = ativo, `I` = inativo |

> ⚠️ **Divergência conhecida:** o campo `situacao` na resposta usa `A`/`I`, enquanto a coluna `st_ativo` no banco usa `S`/`N`. A conversão é feita pelo serviço.

> ⚠️ **Não retornado por este serviço:** nome social, endereço, contatos, data de óbito, data de atualização.

### 4.2 Buscar pacientes por nome

```
GET /sigh-api/paciente/busca?nome={termo}
```

> ⚠️ **Observação de suporte (posterior a esta revisão):** na versão 4.2 o parâmetro `nome` foi renomeado para `termoBusca`. O parâmetro antigo continua aceito até a versão 4.3. Esta seção não foi atualizada.

Retorna no máximo 50 registros. Não há como pedir a página seguinte neste serviço.

### 4.3 Listar pacientes alterados

```
GET /sigh-api/paciente/alterados?desde={yyyy-MM-dd}&pagina={n}
```

Retorna os pacientes cuja `dt_atualizacao` seja posterior à data informada, paginados de 500 em 500.

> ⚠️ **Defeito conhecido — chamado MEDSYS-8841 (aberto em 03/2023, sem previsão):** a partir da página 3 (registro 1001) o serviço retorna resultados duplicados e eventualmente omite registros. O contorno recomendado é restringir a janela de datas para que o resultado não ultrapasse 1000 registros.

> ⚠️ Registros com `dt_atualizacao` nula **nunca** aparecem neste serviço.

### 4.4 Consultar endereço

```
GET /sigh-api/paciente/{codigo}/endereco
```

> **Este serviço não está disponível nas versões 4.0 e 4.1.** Previsto para a versão 4.2. Consulte a Medsys sobre a disponibilidade na sua versão.

### 4.5 Consultar contatos

Não disponível via API. Consulte a tabela `sigh.paciente_contato` diretamente, se houver autorização.

## 5. Tabela de domínios

### Sexo (`tp_sexo`)

| Valor | Descrição |
|---|---|
| `M` | Masculino |
| `F` | Feminino |

### Situação do cadastro (`st_ativo` / `situacao`)

| Banco | API | Descrição |
|---|---|---|
| `S` | `A` | Ativo |
| `N` | `I` | Inativo |

### Tipo de contato (`tp_contato`)

| Valor | Descrição |
|---|---|
| `RES` | Telefone residencial |
| `CEL` | Telefone celular |
| `COM` | Telefone comercial |
| `EML` | E-mail |

## 6. Códigos de erro

| HTTP | Significado |
|---|---|
| 200 | Sucesso |
| 401 | Credencial inválida |
| 404 | Paciente não encontrado |
| 500 | Erro interno |

> **Observação de suporte:** o serviço retorna `200` com corpo vazio em algumas situações de erro, em vez de `404` ou `500`. Verifique o corpo da resposta.

## 7. Limites e recomendações

- Não execute mais de 10 requisições por segundo. Não há controle automático; excesso degrada o SIGH APP.
- A Medsys **recomenda o uso desta API** em vez de acesso direto ao banco de dados. O acesso direto ao banco não é coberto pelo contrato de suporte quanto a mudanças de modelo entre versões.
- Alterações de modelo de dados são publicadas nas notas de versão do SIGH.

---

## Anexo — Notas de campo

*(Anotações manuscritas na cópia entregue pelo suporte da Medsys em 18/07/2026, transcritas)*

- "Rev. 3 é de 2021, cliente está na 4.2.1 — pedir rev. 4 pro produto"
- "4.2 tem endereço sim, testar"
- "`termoBusca` — confirmado, mudou"
- "sexo: existe `I` na base, veio da migração de 2013 do Hospnet. Não está documentado. Ninguém sabe dizer se é 'ignorado' ou 'indeterminado'."
- "nome social: campo `nm_social` existe no banco desde 2019, API nunca expôs"
