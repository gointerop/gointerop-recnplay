# Evidências do projeto

Este diretório reúne o material que a equipe recebeu para construir a integração de cadastro de pacientes entre o **VitaFlow** e o **Hospital Santa Aurora** (sistema SIGH, fornecedor Medsys).

É o material bruto, do jeito que chegou. Nada aqui foi curado, resumido ou reconciliado.

| Arquivo | O que é | Origem | Data |
|---|---|---|---|
| [01-ata-kickoff.md](01-ata-kickoff.md) | Transcrição da reunião de kickoff técnico | Google Meet, transcrição automática revisada em parte | 14/07/2026 |
| [02-requisitos-vitaflow.md](02-requisitos-vitaflow.md) | Documento de requisitos do produto | Gerência de Produto — VitaFlow | 21/07/2026 |
| [03-arquitetura-atual.md](03-arquitetura-atual.md) | Documento de arquitetura do ambiente atual | Coordenação de TI — Santa Aurora | 19/07/2026 |
| [04-api-fornecedor-medsys.md](04-api-fornecedor-medsys.md) | Manual de integração da API do SIGH | Medsys Sistemas Ltda. | 11/2021 |
| [05-banco/dicionario-dados.md](05-banco/dicionario-dados.md) | Dicionário de dados do módulo de cadastro | Medsys Sistemas Ltda. | 03/2019 |
| [05-banco/amostra-anonimizada.csv](05-banco/amostra-anonimizada.csv) | Amostra de 25 registros do cadastro | Extração da réplica de homologação | 22/07/2026 |

O DDL e a carga completa do ambiente de homologação estão em [`../legacy-db/`](../legacy-db/), executáveis com Docker.

---

## Sobre os dados

Todos os dados são **sintéticos**. Nenhum registro real de paciente foi utilizado. A carga é gerada de forma determinística por [`../tools/gen-seed.mjs`](../tools/gen-seed.mjs) e reproduz as distribuições de preenchimento típicas de um cadastro hospitalar com mais de dez anos de operação.

O caso — VitaFlow, Hospital Santa Aurora, Medsys, SIGH — é ficcional. Qualquer semelhança com sistemas reais é intencional apenas no que diz respeito aos padrões de problema, não a instituições específicas.
