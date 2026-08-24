# Descomplicando o FHIR

### Interoperabilidade prática para sistemas de saúde

**Oficina · REC'n'Play Capítulo Saúde 2026**
28 de agosto de 2026 · 9h às 12h · NERD — Porto Digital, Recife

Conduzida pela **[GOInterop](https://gointerop.com)** — onde padrão encontra prática.

---

## Do que se trata

Integração em saúde raramente falha por falta de padrão. Falha porque o conhecimento do domínio vive espalhado: um pedaço na ata de reunião, outro num PDF de fornecedor de 2019, outro no DDL que ninguém abriu, e a verdade mesmo só no dado.

Quando esse conhecimento não é reconciliado antes do código, ele é reconciliado **depois** — em produção, com paciente no meio.

**Spec Engineering** é a prática de transformar essas evidências dispersas em uma especificação revisável, e só então em código. Nesta oficina isso é feito ao vivo, com agente, do zero até uma API FHIR R4 funcionando.

## O caso

A **VitaFlow**, healthtech de jornada do paciente, precisa ler o cadastro de pacientes do **Hospital Santa Aurora**, que roda o **SIGH** do fornecedor **Medsys**. O fornecedor não fala FHIR. Entrega um Postgres e um manual de API desatualizado.

O ponto de partida são cinco evidências em [`evidencias/`](evidencias/) — uma transcrição de reunião, um documento de requisitos, um documento de arquitetura, o manual da API do fornecedor e o dicionário de dados — mais o banco legado real, executável em [`legacy-db/`](legacy-db/).

O ponto de chegada é uma fachada FHIR R4 servindo `Patient` sobre esse banco, sem migrar um único registro.

> Todo o caso é ficcional e todos os dados são sintéticos. As imperfeições do cadastro, essas são reais — foram reproduzidas de propósito.

## O que se constrói ao vivo

| | |
|---|---|
| **Specs** | Proposal, requirements com scenarios, design e tasks — gerados a partir das evidências |
| **Mapeamento** | De-para legado → FHIR, com as decisões e os conflitos registrados |
| **Fachada** | HAPI FHIR R4 servindo `Patient` direto do Postgres legado |
| **Swagger** | Documentação navegável gerada do `CapabilityStatement` |
| **Testes** | Unitários e de integração, cobertura acima de 90% |
| **Conformidade** | Validação dos recursos contra o padrão |
| **Documentação** | Documento de integração pronto para apresentar ao fornecedor |

---

## Como rodar

### Requisitos

- Docker e Docker Compose
- Java 25 e Maven 3.9+
- Node.js 20+
- [Claude Code](https://claude.com/claude-code) autenticado e [OpenSpec](https://github.com/Fission-AI/OpenSpec)

> **Não quer instalar na mão?** [`docs/runbook-ambiente.md`](docs/runbook-ambiente.md) tem um
> prompt para colar no seu agente: ele diagnostica a máquina, instala o que dá, e é honesto
> sobre o que só você pode fazer.

### Banco legado

```bash
docker compose -f legacy-db/docker-compose.yml up -d
```

Postgres em `localhost:55432`, banco `sigh`, usuário `sigh_app` / `sigh_app`. Para leitura, `integracao_ro` / `integracao_ro`.

O schema e a carga são aplicados na primeira subida, a partir de [`legacy-db/migrations/`](legacy-db/migrations/).

### Conferir a carga

```bash
docker exec sigh-db psql -U sigh_app -d sigh -c "SELECT count(*) FROM sigh.paciente;"
```

### Regerar os dados

A carga é determinística — a mesma seed produz sempre os mesmos 200 pacientes.

```bash
node tools/gen-seed.mjs
docker compose -f legacy-db/docker-compose.yml down -v
docker compose -f legacy-db/docker-compose.yml up -d
```

---

## Estrutura

```
evidencias/     as entradas do exercício — ata, requisitos, arquitetura, API, dicionário
legacy-db/      o banco do fornecedor: docker compose, schema e carga
tools/          gerador determinístico dos dados sintéticos
deck/           o deck da oficina e o runner que executa os passos ao vivo
docs/           roteiro e material de apoio
openspec/       nasce ao vivo, durante a oficina
fhir-facade/    nasce ao vivo, durante a oficina
```

## Stack

Java 25 · Spring Boot 4.1.1 · HAPI FHIR 8.10.1 · PostgreSQL 17 · Testcontainers 1.21.4 · JaCoCo 0.8.15 · [OpenSpec](https://github.com/Fission-AI/OpenSpec) 1.10 · Claude Code

---

## Licença

O conteúdo desta oficina é disponibilizado para fins educacionais. Os dados são sintéticos e o caso é ficcional.

**GOInterop** · [gointerop.com](https://gointerop.com) · contato@gointerop.com
FHIR R4 · HL7 · LOINC · TUSS · CID-10 · RNDS
