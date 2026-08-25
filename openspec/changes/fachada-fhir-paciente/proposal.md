## Why

O aplicativo VitaFlow perde 41% dos usuários no onboarding porque o paciente precisa redigitar dados que o Hospital Santa Aurora já possui. O cadastro está no SIGH, sistema do fornecedor Medsys, que não fala FHIR e cuja API está desatualizada, sem manutenção desde 2023 e com defeito conhecido de paginação.

Duas tentativas anteriores de integração falharam — as duas no mesmo ponto, entender o cadastro. O motivo é que as fontes de conhecimento sobre esse cadastro discordam entre si, e a divergência só aparece quando o código encontra o dado real.

O levantamento das evidências confirmou isso. Sobre a identificação do paciente:

| Fonte | Afirma | Realidade |
|---|---|---|
| Ata de kickoff, 14:08:15 | "Todo paciente tem CPF cadastrado" | falso |
| Requisitos VF-412, P-01 e RF-02 | CPF como chave de identificação | insuficiente |
| Dicionário de dados MS-DIC-011 | `nr_cpf` — Obrigatório: **Sim** | falso |
| DDL do fornecedor | `nr_cpf VARCHAR(11)` — aceita nulo | verdadeiro |
| **Dado (200 registros)** | **31 sem CPF (15,5%)** | **verdadeiro** |

E um fato que nenhuma das fontes menciona: **7 pacientes (3,5%) não têm CPF nem CNS**. Não possuem identificador de negócio algum. Uma integração que assuma CPF como chave não consegue representá-los — e em identificação de paciente, representar errado significa prontuário trocado.

## What Changes

- Nova fachada FHIR R4 somente leitura sobre o cadastro do SIGH, expondo o recurso `Patient`
- Leitura direta da réplica PostgreSQL do fornecedor, com privilégio de `SELECT` apenas
- Nenhum dado é migrado, copiado ou persistido: o recurso FHIR é montado em memória a cada requisição
- Busca por `_id`, `identifier`, `name`, `birthdate` e `_lastUpdated`
- `CapabilityStatement` e documentação navegável (Swagger UI) gerados a partir do servidor
- Validação de conformidade dos recursos contra o FHIR R4
- Documento de integração destinado ao fornecedor e à TI do hospital

Não há mudança de comportamento em sistema existente. Nada é quebrado porque nada existia.

## Capabilities

### New Capabilities

- `paciente-fhir`: exposição do cadastro de pacientes do SIGH como recurso `Patient` do FHIR R4, incluindo o mapeamento do modelo legado, as regras de identificação e o comportamento de busca.

### Modified Capabilities

Nenhuma.

## Impact

**Novo componente:** `fhir-facade/`, aplicação Java 25 / Spring Boot 4.1.1 com HAPI FHIR 8.10.1 no padrão Plain Server.

**Sistemas de origem:** somente leitura sobre o schema `sigh` do PostgreSQL do SIGH. Nenhuma alteração de schema, índice, trigger ou view — isso invalidaria o contrato de suporte da Medsys (restrição RA-02).

**Acoplamento assumido:** a decisão DA-01 do documento de arquitetura acopla a integração ao **modelo de dados** do fornecedor em vez de a um contrato de API. Atualizações do SIGH podem quebrar a fachada. Mitigação: testes de integração contra o schema real, executados a cada atualização.

**Proteção de dados:** base legal art. 11, II, "f" da LGPD. Nome da mãe fica fora do retorno por decisão do encarregado de dados (PD-03). CPF não trafega em URL nem em log (PD-04, RNF-05).

**Riscos que permanecem abertos:** a sincronização incremental depende de `dt_atualizacao`, nula em 7% dos registros e não confiável por admissão do próprio fornecedor. Detalhado em `design.md`.
