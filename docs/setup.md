# Setup

> Este documento é a referência detalhada. Para montar o ambiente do zero, o caminho mais curto
> é o [runbook por agente](runbook-ambiente.md).

## Requisitos

| | Versão validada |
|---|---|
| Docker + Compose | 29.2 / v5.0 |
| Java (JDK) | 25 — Temurin |
| Maven | 3.9.12 |
| Node.js | 24 |
| Claude Code | 2.1.206 |
| OpenSpec | 1.10 — `npm i -g @fission-ai/openspec` |

## Subir tudo

```bash
docker compose -f legacy-db/docker-compose.yml up -d
```

Postgres em `localhost:55432`, banco `sigh`. Usuário de aplicação `sigh_app` / `sigh_app`;
usuário somente leitura `integracao_ro` / `integracao_ro`. O schema e a carga são aplicados
na primeira subida.

```bash
docker exec sigh-db psql -U sigh_app -d sigh -c "SELECT count(*) FROM sigh.paciente;"
```

## Build e testes da fachada

```bash
cd fhir-facade && mvn -B verify
```

Os testes de integração sobem um Postgres próprio por Testcontainers, aplicando **as mesmas
migrations** de `legacy-db/migrations/`. O build quebra se a cobertura cair abaixo de 90%.

Para rodar a fachada:

```bash
cd fhir-facade && mvn spring-boot:run
```

- FHIR: `http://localhost:8090/fhir`
- Swagger UI: `http://localhost:8090/fhir/swagger-ui/`
- CapabilityStatement: `http://localhost:8090/fhir/metadata`

## Deck

```bash
node deck/runner.mjs
```

Abre em `http://localhost:4173`. Se a porta estiver ocupada, use `--port 4174`.

O deck dispara os passos de `deck/steps.json` pelo Claude Code em modo headless. Para isso
a **sessão do Claude Code precisa estar autenticada nesta máquina** — rode `claude` uma vez
no terminal e confirme. Sem isso o disparo falha com `Failed to authenticate`.

## Gravar os passos para o modo REPLAY

O REPLAY é a rede de segurança da oficina: reproduz um ensaio gravado quando a execução ao
vivo falha ou demora demais. Precisa ser gerado antes.

```bash
node tools/run-step.mjs --list        # ver o que já está gravado
node tools/run-step.mjs 01            # gravar um passo
node tools/run-step.mjs 01 02 03      # gravar em sequência
node tools/run-step.mjs --reset       # zerar a sessão encadeada
```

Os passos compartilham uma sessão: o primeiro cria com `--session-id` e os seguintes retomam
com `--resume`. É o que permite encadear os prompts slide a slide sem perder contexto — então
**grave na ordem**, do 01 ao 07.

O identificador da sessão é gerado a cada cadeia nova e guardado em `deck/recordings/.session`.
Não é fixo de propósito: o Claude Code recusa reutilizar um id com `Session ID already in use`,
então um id fixo permitiria um único ensaio por máquina — e o dia da oficina colidiria com o
último ensaio. Para começar outra cadeia do zero, `--reset`.

### Idioma da resposta do agente

`deck/steps.json` tem a chave `instrucaoDeSistema`, aplicada a todo passo. Ela existe porque o
agente responde em inglês mesmo com prompt em português, e o texto dele vai projetado.
Para desligar, apague a chave.

### Onde gravar

As gravações devem sair do estado inicial da oficina, e não de `main`: com `openspec/` e
`fhir-facade/` já presentes, o `/opsx:propose` perguntaria se quer continuar a change existente
e o `/opsx:apply` diria que já está feito. Use um worktree, que não mexe na sua cópia de
trabalho:

```bash
git worktree add ../ensaio palco-inicio
cd ../ensaio && node tools/run-step.mjs 01 02 03 04 05 06 07
```

Depois copie `deck/recordings/*.jsonl` de volta para o repositório e comite. Para desmontar:
`git worktree remove ../ensaio`.

As gravações ficam em `deck/recordings/`. Uma execução que falha **não** sobrescreve uma
gravação boa: ela escreve num arquivo parcial e só promove se terminar bem.

**Quem grava é o `run-step.mjs`, não o deck.** Uma execução LIVE disparada pelo runner nunca
substitui uma gravação existente — ali o LIVE é apresentação ou teste, e sobrescrever destruiria
a rede de segurança. Para regravar de propósito, use o `run-step.mjs`, que sobrescreve por ser
essa a sua função.

## Regerar os dados sintéticos

A carga é determinística — a mesma seed produz sempre os mesmos 200 pacientes, com as mesmas
imperfeições.

```bash
node tools/gen-seed.mjs
docker compose -f legacy-db/docker-compose.yml down -v
docker compose -f legacy-db/docker-compose.yml up -d
```

> Alterar a seed muda os códigos dos pacientes, e os testes de integração ancoram em códigos
> específicos — `10001`, `10010` e `10027`. Se regerar com outra seed, atualize as constantes
> de `FachadaIntegracaoTest`.

## Branches

| Branch | Para quê |
|---|---|
| `main` | material completo — specs, fachada, deck, tudo pronto |
| `palco-inicio` | estado inicial da oficina: evidências, banco e deck, **sem** `openspec/` e `fhir-facade/` |

Para preparar o palco: `git checkout palco-inicio`.
Para resgatar o resultado pronto no meio da demo: `git checkout main -- openspec fhir-facade`.
