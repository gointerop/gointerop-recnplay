# Runbook — montar o ambiente com um agente

Reproduzir esta oficina exige Docker, Java 25, Maven, Node, OpenSpec e o Claude Code autenticado — em qualquer um dos três sistemas operacionais. É trabalho chato o bastante para desistir no meio, e é exatamente o tipo de tarefa que um agente faz bem.

**Copie o bloco abaixo inteiro e cole no seu agente**, com o repositório já clonado e aberto. Funciona no Claude Code e em qualquer outro agente com acesso ao terminal.

```
Você vai preparar minha máquina para rodar a oficina "Descomplicando o FHIR"
(github.com/gointerop/gointerop-recnplay). Estou com o repositório clonado e
aberto no diretório atual.

REGRAS — valem acima de qualquer passo abaixo:

1. Diagnostique tudo ANTES de instalar qualquer coisa. Me mostre o relatório
   completo e espere eu confirmar antes da primeira instalação.
2. Não toque em ferramenta que já está instalada e funcionando, mesmo que a
   versão seja diferente da que eu peço. Relate a diferença e siga em frente.
   Não "conserte" o que não pedi.
3. Nunca use sudo sem antes me dizer exatamente qual comando vai rodar e por quê.
4. Não altere PATH, variáveis de ambiente ou configuração de shell sem me avisar
   e explicar o efeito.
5. Se algo sair do previsto neste roteiro, pare e me pergunte. Não improvise na
   minha máquina.

O QUE O AMBIENTE PRECISA TER:

  Docker + Docker Compose v2   sobe o banco legado em contêiner
  Java 25 (JDK)                a fachada fixa essa versão no pom.xml
  Maven 3.9+                   build da fachada
  Node.js 20+                  runner do deck e gerador de dados
  OpenSpec                     npm i -g @fission-ai/openspec
  Claude Code                  o agente que constrói, autenticado

PASSO 1 — Diagnóstico

Descubra o sistema operacional e qual gerenciador de pacotes existe (winget no
Windows, Homebrew no macOS, apt ou equivalente no Linux).

Verifique cada item da lista acima e sua versão. Monte uma tabela com três
colunas: ferramenta, versão encontrada, situação (ok / faltando / versão
diferente). Me mostre e espere minha confirmação.

PASSO 2 — Instalar o que dá

Depois que eu confirmar, instale pelo gerenciador de pacotes apenas o que estiver
faltando: Node.js, Maven, JDK 25 (distribuição Temurin) e OpenSpec via npm.

Instale um de cada vez e confira que funcionou antes de passar ao próximo.

PASSO 3 — O que eu preciso fazer

Duas coisas você não faz, e não deve tentar:

  - Docker Desktop: instalador gráfico, e no Windows exige reiniciar. Se estiver
    faltando, me diga onde baixar e pare até eu confirmar que instalei.
  - Login do Claude Code: é fluxo interativo de autenticação. Se `claude
    --version` responder mas a autenticação estiver expirada, me diga para rodar
    `claude` no terminal e fazer login.

PASSO 4 — Subir o banco legado

    docker compose -f legacy-db/docker-compose.yml up -d

Espere ficar saudável e confirme a carga:

    docker exec sigh-db psql -U sigh_app -d sigh -c "SELECT count(*) FROM sigh.paciente;"

Precisa retornar 200. Se retornar outro número, pare e me avise.

PASSO 5 — Build da fachada

    cd fhir-facade && mvn -B verify

Precisa terminar com BUILD SUCCESS. O build quebra de propósito se a cobertura
cair abaixo de 90%, então build verde já significa cobertura em dia. Me diga o
número final de testes e a cobertura.

Este passo baixa bastante coisa na primeira vez e sobe um Postgres por
Testcontainers. Pode levar alguns minutos.

PASSO 6 — Subir o deck

    node deck/runner.mjs

Ele imprime a URL, a versão do Claude Code encontrada e os diretórios que está
observando. Me passe a URL.

PASSO 7 — Relatório final

Feche com um checklist de duas listas: o que ficou pronto e o que ficou
pendente, com o que eu preciso fazer em cada pendência.
```

---

## O que o runbook não resolve

Três coisas que nenhum agente contorna. Melhor saber antes de começar:

| | |
|---|---|
| **Docker Desktop** | Instalador gráfico, e no Windows pede reinício. O agente detecta e instrui; a instalação é sua. |
| **Login do Claude Code** | Autenticação interativa. O agente não faz, e não deve tentar. |
| **Conta com acesso a um modelo** | Reproduzir a oficina roda agente de verdade e consome tokens de verdade: o ensaio completo levou **64 minutos** de agente e custou cerca de **US$ 33**. |

---

## Caminho manual

Se preferir montar na mão, ou se o agente esbarrar em algo:

| Ferramenta | Windows (winget) | macOS (Homebrew) | Linux (apt) |
|---|---|---|---|
| Docker | baixe o Docker Desktop | `brew install --cask docker` | `apt install docker.io docker-compose-v2` |
| JDK 25 | `winget install EclipseAdoptium.Temurin.25.JDK` | `brew install --cask temurin@25` | `apt install openjdk-25-jdk` |
| Maven | `winget install Apache.Maven` | `brew install maven` | `apt install maven` |
| Node.js | `winget install OpenJS.NodeJS.LTS` | `brew install node` | `apt install nodejs npm` |
| OpenSpec | `npm i -g @fission-ai/openspec` | idem | idem |
| Claude Code | `npm i -g @anthropic-ai/claude-code` | idem | idem |

Depois, os comandos dos passos 4 a 6 do bloco acima, na ordem.

O [`setup.md`](setup.md) tem a referência detalhada: portas, usuários do banco, como gravar os passos para o modo REPLAY e como regerar os dados sintéticos.

---

## Sobre o Java 25

A fachada fixa `<java.version>25</java.version>` no `pom.xml`, e essa é a maior barreira de reprodução do projeto — muita gente tem 17 ou 21 instalado. O runbook instala o Temurin 25 quando falta, o que resolve, mas exige uma JDK a mais na máquina.

Ter outras versões de Java instaladas não atrapalha, desde que a 25 seja a que o Maven enxerga. Se o build reclamar de versão, confira o `JAVA_HOME`.
