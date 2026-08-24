## Context

O acesso à origem é a réplica somente leitura do PostgreSQL do SIGH, com usuário de privilégio `SELECT` no schema `sigh` (decisão DA-01 do documento de arquitetura). A API do fornecedor foi descartada: documentação de 2021 para um sistema em 4.2.1, retorno XML com charset declarado incorretamente, defeito de paginação aberto desde 2023 e ausência de nome social e endereço no retorno.

O schema de origem não tem constraints de integridade referencial — foram removidas em 2021 por decisão do fornecedor. Nenhuma consulta pode assumir que um `cd_paciente` em tabela filha exista em `paciente`, nem que exista exatamente um contato ou endereço marcado como principal.

Produção roda PostgreSQL 12.14; a homologação roda 17. Nenhum recurso posterior à 12 pode ser usado.

## Goals / Non-Goals

**Goals:**

- Contrato FHIR R4 estável sobre um modelo de dados que não controlamos
- Nenhuma escrita e nenhuma cópia persistente: o recurso é montado por requisição
- Todo mapeamento e toda decisão rastreáveis até a evidência que os originou
- Falha de conversão de um paciente não derruba a consulta dos demais

**Non-Goals:**

- Outros recursos FHIR além de `Patient`
- Perfis brasileiros homologados (br-core, RNDS). Os systems de CPF e CNS são adotados, mas não há conformidade declarada a IG nacional nesta entrega
- Escrita, reconciliação de duplicidade ou MPI
- Autenticação e autorização do consumidor — resolvidas no perímetro de rede nesta fase
- Cache. A primeira entrega consulta a origem a cada requisição

## Decisions

### Plain Server em vez de JPA Server

O HAPI oferece dois caminhos. O JPA Server traz um repositório FHIR completo, com persistência própria — o que exigiria migrar o cadastro, violando RNF-03 e RA-01. O Plain Server permite implementar `IResourceProvider` sobre qualquer origem, montando o recurso em memória.

Escolhido o Plain Server. A fachada é um tradutor, não um repositório.

### `cd_paciente` como identificador lógico

Alternativa considerada e recusada: CPF como `Patient.id`. O dado derruba a opção — 15,5% dos registros não têm CPF, e 3,5% não têm CPF nem CNS. Também é conceitualmente errado: `Patient.id` é o identificador do *recurso naquele servidor*, enquanto CPF é identificador *da pessoa no mundo*, e o lugar dele é `Patient.identifier`.

Consequência aceita: o `Patient.id` só faz sentido dentro do contexto desta fachada. Consumidores que precisem correlacionar entre sistemas usam `identifier`.

### Uma consulta com junções, não N+1

O recurso precisa de paciente, contatos, endereço e nome do município. Buscar cada bloco em consulta separada por paciente produziria N+1 numa busca que devolve dezenas de resultados, contra um banco de produção de 480 mil registros.

A leitura usa uma consulta com `LEFT JOIN` sobre as quatro tabelas, agrupando as linhas por `cd_paciente` na aplicação. Como não há FK, a junção é defensiva: ausência de linha filha é caso normal, nunca erro.

### Normalização de telefone na fachada

A origem grava telefone como texto livre, em ao menos seis formatos. Normalizar no SQL exigiria expressões regulares que dependem da versão do PostgreSQL, e a produção está na 12. A normalização acontece em Java: remove tudo que não é dígito e descarta o prefixo `55` quando o resultado tem 12 ou 13 dígitos.

### `_lastUpdated` sobre `COALESCE(dt_atualizacao, dt_cadastro)`

Alternativa considerada e recusada: usar `dt_atualizacao` diretamente. Isso tornaria 7% dos registros permanentemente invisíveis a qualquer consumidor que sincronize incrementalmente — exatamente o defeito que a API do fornecedor já tem, documentado na seção 4.3 do manual.

O fallback para `dt_cadastro` garante que todo registro tenha uma data efetiva. Não resolve o problema de fundo, que é o batch escrevendo direto no banco sem atualizar o carimbo. Ver Riscos.

### Conversão isolada por paciente

Uma linha malformada não pode derrubar um `Bundle` inteiro. Cada paciente é convertido isoladamente; falha de conversão é registrada e o paciente é omitido do resultado, sem interromper os demais. O log registra `cd_paciente` e a causa — nunca CPF ou CNS.

## Risks / Trade-offs

| Risco | Gravidade | Trade-off aceito / mitigação |
|---|---|---|
| **Acoplamento ao modelo do fornecedor.** Atualização do SIGH pode renomear ou remover coluna e quebrar a fachada em produção. | Alta | Consequência direta da decisão DA-01. Mitigação: testes de integração contra o schema real, executados a cada atualização do SIGH. A quebra aparece no build, não em produção. |
| **Sincronização incremental permanece incompleta.** O `COALESCE` cobre registro sem carimbo, mas não cobre alteração feita por batch que não atualiza `dt_atualizacao`. Um paciente pode mudar sem que o consumidor perceba. | Alta | Não é solucionável do lado da fachada. Mitigação operacional: varredura completa periódica além da incremental. Registrado no documento de integração como pedido de mudança à Medsys. |
| **Ausência de constraints na origem.** Contato órfão, endereço duplicado marcado como principal, município inexistente na tabela do IBGE. | Média | Toda junção é defensiva. Quando há mais de um endereço principal, adota-se o de menor `cd_endereco`, de forma determinística. |
| **Divergência entre homologação e produção** (PG 17 contra 12.14). | Média | Nenhum recurso posterior à 12 é usado. O contêiner de teste deveria acompanhar a produção — item pendente para a próxima entrega. |
| **Sem cache, sob carga real.** RNF-04 exige 800 ms no percentil 95 contra 480 mil registros. | Média | Os índices existentes cobrem CPF, CNS, nome e `dt_atualizacao`. Busca por nome com correspondência parcial e sem acento não é coberta por índice e pode degradar. Medir antes de introduzir cache. |
| **Sem autenticação na fachada.** | Média | Aceito nesta fase: o acesso está confinado à DMZ e ao túnel VPN. Precisa de decisão antes de qualquer exposição fora do perímetro. |
