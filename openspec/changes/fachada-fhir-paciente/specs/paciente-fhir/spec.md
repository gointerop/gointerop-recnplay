## Purpose

Expor o cadastro de pacientes do sistema legado SIGH como recurso `Patient` do FHIR R4, em modo somente leitura e sem replicar dado, de forma que consumidores externos identifiquem e consultem pacientes por um contrato padronizado em vez do modelo interno do fornecedor.

## ADDED Requirements

### Requirement: Identificação lógica do recurso

O sistema SHALL usar `sigh.paciente.cd_paciente` como identificador lógico do recurso `Patient`.

CPF e CNS MUST NOT ser usados como identificador lógico. O levantamento das evidências mostrou que 15,5% dos registros não possuem CPF e 3,5% não possuem CPF nem CNS, enquanto `cd_paciente` está presente em 100% dos registros e é chave primária que nunca é reaproveitada.

#### Scenario: Recurso identificado pelo código do SIGH

- **WHEN** um consumidor solicita o paciente de código `10001`
- **THEN** o sistema retorna um recurso `Patient` com `Patient.id` igual a `10001`

#### Scenario: Código inexistente

- **WHEN** um consumidor solicita um paciente cujo código não existe no SIGH
- **THEN** o sistema responde com `404 Not Found` e um `OperationOutcome`

### Requirement: Identificadores de negócio opcionais

O sistema SHALL expor CPF e CNS como entradas de `Patient.identifier`, cada uma presente somente quando houver valor na origem.

O CPF MUST usar o system `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf` e o CNS MUST usar o system `http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns`. Os valores MUST ser expostos sem máscara, apenas dígitos.

#### Scenario: Paciente com CPF e CNS

- **WHEN** o registro de origem possui `nr_cpf` e `nr_cns` preenchidos
- **THEN** `Patient.identifier` contém duas entradas, uma com o system de CPF e outra com o system de CNS

#### Scenario: Paciente apenas com CNS

- **WHEN** o registro de origem possui `nr_cns` preenchido e `nr_cpf` nulo
- **THEN** `Patient.identifier` contém exatamente uma entrada, com o system de CNS

### Requirement: Paciente sem identificador de negócio

O sistema SHALL retornar normalmente pacientes que não possuam CPF nem CNS.

A ausência de identificador de negócio MUST NOT ser tratada como erro, registro inválido ou exceção. São 3,5% da base — cadastros anteriores a 2015, originados da migração do sistema Hospnet em 2013.

#### Scenario: Paciente sem CPF e sem CNS

- **WHEN** um consumidor solicita um paciente cujo registro tem `nr_cpf` e `nr_cns` nulos
- **THEN** o sistema retorna `200 OK` com um recurso `Patient` válido
- **AND** o recurso não possui o elemento `identifier`
- **AND** o recurso passa em validação de conformidade FHIR R4 sem issue de severidade `error`

### Requirement: Nome social com precedência de exibição

O sistema SHALL expor o nome social, quando existir, como `Patient.name` com `use = usual`, e o nome civil sempre como `Patient.name` com `use = official`.

Esta é obrigação legal decorrente do Decreto 8.727/2016, e não preferência de produto. O nome civil MUST permanecer disponível para emissão de documento.

#### Scenario: Paciente com nome social

- **WHEN** o registro de origem possui `nm_social` preenchido
- **THEN** `Patient.name` contém duas entradas
- **AND** a entrada com `use = usual` traz o valor de `nm_social`
- **AND** a entrada com `use = official` traz o valor de `nm_paciente`

#### Scenario: Paciente sem nome social

- **WHEN** o registro de origem possui `nm_social` nulo
- **THEN** `Patient.name` contém exatamente uma entrada, com `use = official` e o valor de `nm_paciente`

### Requirement: Mapeamento de sexo

O sistema SHALL mapear `tp_sexo` para `Patient.gender` conforme a tabela: `M` para `male`, `F` para `female`, `I` para `unknown`, nulo para ausência do elemento.

O valor `I` MUST mapear para `unknown` e MUST NOT mapear para `other`. O código `other` afirma que a pessoa não é masculino nem feminino, o que a origem não sustenta: `I` não consta no domínio `SEXO` da tabela `de_para_dominio`, não é documentado pelo fornecedor e, conforme nota de campo do suporte da Medsys, veio da migração de 2013 sem que ninguém saiba se significa "ignorado" ou "indeterminado". `unknown` é a única leitura que a evidência sustenta.

#### Scenario: Sexo indeterminado

- **WHEN** o registro de origem possui `tp_sexo` igual a `I`
- **THEN** `Patient.gender` é `unknown`

#### Scenario: Sexo não informado

- **WHEN** o registro de origem possui `tp_sexo` nulo
- **THEN** o recurso não possui o elemento `Patient.gender`

### Requirement: Situação cadastral e óbito são independentes

O sistema SHALL mapear `st_ativo` para `Patient.active` e `dt_obito` para `Patient.deceasedDateTime`, tratando os dois como informações independentes.

Um cadastro inativo MUST NOT ser interpretado como óbito. `st_ativo = 'N'` indica desativação administrativa — duplicidade, cadastro incorreto ou solicitação do titular — e pode corresponder a pessoa viva.

#### Scenario: Cadastro inativo sem óbito

- **WHEN** o registro possui `st_ativo` igual a `N` e `dt_obito` nulo
- **THEN** `Patient.active` é `false`
- **AND** o recurso não possui o elemento `deceasedDateTime`

#### Scenario: Óbito registrado

- **WHEN** o registro possui `dt_obito` preenchido
- **THEN** `Patient.deceasedDateTime` traz a data do óbito

### Requirement: Contatos normalizados

O sistema SHALL expor os contatos do paciente em `Patient.telecom`, mapeando `tp_contato` para `system` e `use`: `CEL` para `phone`/`mobile`, `RES` para `phone`/`home`, `COM` para `phone`/`work` e `EML` para `email`.

Os telefones MUST ser normalizados para apenas dígitos, com o código do país removido quando presente. A origem grava telefone como texto livre, sem máscara nem validação, em ao menos seis formatos distintos.

#### Scenario: Telefone em formato livre

- **WHEN** o registro de contato possui `ds_contato` igual a `(81) 99999-9999`
- **THEN** o `Patient.telecom` correspondente traz o valor `81999999999`

#### Scenario: Telefone com código do país

- **WHEN** o registro de contato possui `ds_contato` igual a `+55 81 999999999`
- **THEN** o `Patient.telecom` correspondente traz o valor `81999999999`

#### Scenario: Paciente sem contato

- **WHEN** o paciente não possui nenhum registro em `paciente_contato`
- **THEN** o recurso não possui o elemento `telecom`

### Requirement: Endereço

O sistema SHALL expor o endereço do paciente em `Patient.address`, com `line` a partir de logradouro, número e complemento, `district` a partir do bairro, `city` a partir do nome do município, `state` a partir da UF, `postalCode` a partir do CEP e `country` fixo em `BR`.

Elementos sem valor na origem MUST ser omitidos, nunca preenchidos com texto vazio ou marcador.

#### Scenario: Endereço completo

- **WHEN** o paciente possui endereço com todos os campos preenchidos
- **THEN** `Patient.address` traz `line`, `district`, `city`, `state`, `postalCode` e `country` igual a `BR`

#### Scenario: Endereço sem CEP

- **WHEN** o endereço do paciente possui `nr_cep` nulo
- **THEN** `Patient.address` é retornado sem o elemento `postalCode`

#### Scenario: Paciente sem endereço

- **WHEN** o paciente não possui registro em `paciente_endereco`
- **THEN** o recurso não possui o elemento `address`

### Requirement: Nome da mãe fora do retorno

O sistema MUST NOT expor `nm_mae` em nenhum elemento do recurso `Patient`, nem por padrão, nem mediante parâmetro de consulta.

Restrição PD-03, determinada pelo encarregado de dados do hospital: o uso pretendido — desambiguação de homônimos — não constitui finalidade declarada, e o princípio da minimização impede que o dado trafegue por conveniência.

#### Scenario: Nome da mãe não trafega

- **WHEN** um consumidor obtém qualquer paciente por qualquer operação de leitura
- **THEN** o recurso retornado não contém o nome da mãe em nenhum elemento

### Requirement: Busca por identificador de negócio

O sistema SHALL suportar busca por `identifier`, aceitando o valor com ou sem o system, e retornar um `Bundle` do tipo `searchset`.

#### Scenario: Busca por CPF com system

- **WHEN** um consumidor busca por `identifier` com system de CPF e um valor existente
- **THEN** o sistema retorna um `Bundle` contendo o paciente correspondente

#### Scenario: Busca sem resultado

- **WHEN** um consumidor busca por um identificador que não existe
- **THEN** o sistema retorna um `Bundle` do tipo `searchset` com `total` igual a zero

### Requirement: Busca por nome

O sistema SHALL suportar busca por `name`, com correspondência parcial, insensível a caixa e insensível a acentuação, considerando tanto o nome civil quanto o nome social.

#### Scenario: Busca parcial sem acento

- **WHEN** um consumidor busca por `name` com o termo `antonio`
- **THEN** o resultado inclui pacientes cujo nome civil é `Antônio`

#### Scenario: Busca encontra pelo nome social

- **WHEN** um consumidor busca por `name` com um termo que consta apenas no nome social de um paciente
- **THEN** o resultado inclui esse paciente

### Requirement: Busca por data de nascimento

O sistema SHALL suportar busca por `birthdate` com igualdade e com os prefixos de comparação `gt`, `lt`, `ge` e `le`.

#### Scenario: Data exata

- **WHEN** um consumidor busca por `birthdate` igual a uma data específica
- **THEN** o resultado contém apenas pacientes nascidos nessa data

### Requirement: Busca incremental por data de atualização

O sistema SHALL suportar busca por `_lastUpdated` e MUST derivar esse valor de `COALESCE(dt_atualizacao, dt_cadastro)`.

O campo `dt_atualizacao` é nulo em 7% dos registros e não é confiável por admissão do próprio fornecedor: a trigger da aplicação não cobre carga histórica nem processos batch que escrevem direto no banco. Sem o fallback, esses registros seriam invisíveis a qualquer consumidor que sincronize incrementalmente.

#### Scenario: Registro sem data de atualização

- **WHEN** um consumidor busca por `_lastUpdated` maior que uma data anterior ao cadastro de um paciente sem `dt_atualizacao`
- **THEN** esse paciente consta no resultado
- **AND** `Patient.meta.lastUpdated` traz a data de cadastro

#### Scenario: Sincronização incremental

- **WHEN** um consumidor busca por `_lastUpdated` maior que um instante
- **THEN** o resultado contém apenas pacientes cuja data efetiva de atualização é posterior a esse instante

### Requirement: Somente leitura

O sistema MUST NOT expor nenhuma operação de escrita sobre `Patient`.

Requisições de criação, atualização, substituição ou remoção MUST ser rejeitadas. A conexão com a origem MUST utilizar credencial com privilégio exclusivo de `SELECT` sobre o schema `sigh`.

#### Scenario: Tentativa de criação rejeitada

- **WHEN** um consumidor envia uma requisição de criação de `Patient`
- **THEN** o sistema responde com erro indicando que a operação não é suportada
- **AND** nenhuma escrita ocorre na origem

#### Scenario: Capacidades declaram apenas leitura

- **WHEN** um consumidor obtém o `CapabilityStatement`
- **THEN** as interações declaradas para `Patient` são exclusivamente de leitura e busca

### Requirement: Dado sensível fora de URL e log

O sistema MUST NOT registrar CPF ou CNS em log de aplicação ou de acesso, e MUST NOT aceitar CPF como segmento de caminho na URL.

Restrições PD-04 e RNF-05.

#### Scenario: Busca por CPF não registra o valor

- **WHEN** um consumidor realiza busca por `identifier` com um CPF
- **THEN** nenhum registro de log produzido contém o valor do CPF

### Requirement: Documentação navegável e capacidades

O sistema SHALL publicar `CapabilityStatement` em `/metadata` e documentação navegável derivada dele.

#### Scenario: Documentação disponível

- **WHEN** um consumidor acessa a rota de documentação navegável
- **THEN** a documentação é servida e descreve as operações de leitura e busca de `Patient`

### Requirement: Conformidade com FHIR R4

Todo recurso `Patient` produzido pelo sistema MUST passar em validação contra o FHIR R4 sem issue de severidade `error` ou `fatal`.

#### Scenario: Validação da amostra completa

- **WHEN** todos os pacientes da base de homologação são convertidos e validados
- **THEN** nenhum recurso apresenta issue de severidade `error` ou `fatal`
