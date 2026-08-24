# Roteiro — Descomplicando o FHIR

**28 de agosto de 2026 · 9h às 12h · NERD, Porto Digital, Recife**
Público: startups e ecossistema healthtech. Formato expositivo, você dirige, a plateia assiste.

---

## Antes de tudo: checklist de montagem

Faça na véspera, e refaça na manhã do dia. Leva dez minutos e cobre tudo o que já falhou em ensaio.

### Véspera (27/08)

- [ ] **Autenticar o Claude Code.** Abra `claude` no terminal e confirme que a sessão está válida.
      Sessão de OAuth expirada faz o `S` do deck falhar com `Failed to authenticate` — e é
      silenciosa até você tentar usar.
- [ ] `docker compose -f legacy-db/docker-compose.yml up -d` e confirmar 200 pacientes
- [ ] `cd fhir-facade && mvn -B verify` — build verde de ponta a ponta
- [ ] `node tools/run-step.mjs --list` — **todos os sete passos devem estar gravados**
- [ ] Ensaio integral em REPLAY **com o Wi-Fi desligado**
- [ ] Fonte do terminal em 18pt ou mais; deck testado na resolução do projetor
- [ ] Bateria carregada, fonte na mochila, roteador 4G próprio

### Manhã do dia (28/08, até 8h40)

- [ ] Docker aberto e contêiner de pé **60 minutos antes** — não deixe para 8h55
- [ ] `node deck/runner.mjs` e abrir `http://localhost:4173`
- [ ] Verificar que o painel lateral abre no slide 10 (primeiro passo)
- [ ] Confirmar `claude` autenticado, de novo
- [ ] Notificações e atualizações do sistema desligadas
- [ ] Slide 1 na tela, plateia entrando

### Comandos do deck

| Tecla | Ação |
|---|---|
| `→` `Espaço` | próximo slide |
| `←` | slide anterior |
| `S` | dispara o passo do slide |
| `R` | alterna LIVE ↔ REPLAY |
| `Esc` | aborta o passo em execução |
| `L` | limpa o painel |
| `?` | ajuda |

**A regra de ouro:** se um passo passar de quatro minutos ou travar, aperte `Esc`, depois `R`,
depois `S`. O REPLAY assume, acelerado, e a sala não percebe.

---

## Roteiro

### 09:00 — Abertura *(slides 1–3, 10 min)*

Capa, GOInterop, o combinado.

> "Nas próximas três horas a gente não vai falar sobre integração. A gente vai fazer uma.
> Do zero. Com o código nascendo na tela. E tudo o que aparecer aqui vai estar no
> repositório quando vocês saírem."

Aponte para a fileira de personas na capa. Elas voltam no fim.

---

### 09:10 — Por que integração em saúde falha *(slides 4–6, 20 min)*

**Slide 4 — as duas integrações mortas.** Conte como história, não como estatística.
Deixe o silêncio depois de *"na terceira vez a diretoria cancelou"*.

**Slide 5 — as cinco fontes.** Este é o slide que sustenta a oficina inteira.
Pergunte à plateia, de verdade: *"quem aqui já achou o de-para numa planilha que ninguém
sabia quem mantinha?"* Espere as mãos.

**Slide 6 — o custo.** A frase que fica: **a divergência sempre aparece, você só escolhe quando.**

---

### 09:30 — Spec Engineering *(slides 7–10, 20 min)*

**Slide 7** — a definição. **Slide 8** — a tabela contra prompt direto. Aqui a plateia de
startup entende o argumento: *agente rápido sem spec não acelera o projeto, acelera o retrabalho*.

**Slide 9** — leia o requirement em voz alta, inteiro. É a primeira vez que eles veem a forma.

**Slide 10** — o ciclo. Enfatize que `/opsx:propose` **para** antes de implementar. A fronteira
é do método, não da disciplina de quem está cansado às onze da noite.

---

### 09:50 — As evidências *(slides 11–13, 12 min)*

Abra os arquivos de verdade em `evidencias/` se der tempo. Se não der, os slides bastam.

No slide 12, aponte as datas: **o documento mais confiante é o mais antigo.**
No slide 13, a pergunta: *"reconheceu o seu banco?"*

---

### 10:02 — DEMO 1 *(slides 14–18, 28 min)*

**Slide 14 · passo 01 — `S`.** Enquanto roda, narre o que o agente está fazendo. Não fique em
silêncio olhando o painel.

**Slide 15 — PARE.** Este é o momento da oficina. Não corra.

1. Leia a tabela das quatro fontes, uma por uma, em voz alta
2. Rode a query ao vivo, num terminal ao lado
3. Deixe o número aparecer

> "A ata errou. O requisito errou. E o dicionário do fornecedor — que é o documento mais
> formal dos três — também errou. Só o dado estava certo."

**Slide 16 — Dona Terezinha.** Aqui o número vira gente. Vá devagar.

> "São sete pessoas. E nenhuma das cinco evidências menciona que elas existem."

**Slide 17 — as outras personas.** Mais rápido, é reforço.

**Slide 18 · passo 02 — `S`.** O agente propõe e **pergunta** sobre a identificação.
Se ele perguntar, comemore: é exatamente o comportamento que a oficina defende.

*(Se o passo 03 couber antes de 10:30, rode. Se não, ele abre o bloco depois do intervalo.)*

---

### 10:30 — Intervalo *(slide 19, 15 min)*

Deixe o slide na tela. Aproveite para conferir que o contêiner segue de pé.

---

### 10:45 — DEMO 2 *(slides 20–21, 30 min)*

**Slide 20 — fachada, não repositório.** Trinta segundos de conceito antes de rodar.
A frase: *migração costuma ser a resposta cara para a pergunta errada.*

**Slide 21 · passo 04 — `S`.** O passo mais longo da sessão. Enquanto roda:

- aponte os arquivos aparecendo na árvore lateral
- comente que os testes nascem junto com o código, não depois
- se passar de quatro minutos, `Esc` `R` `S` sem hesitar

---

### 11:15 — DEMO 3 *(slides 22–23, 20 min)*

**Slide 22 · passo 05 — `S`.** O build fechando verde. Mostre a cobertura e a validação.

**Slide 23 — o bug do fuso.** Guarde este para o fim do bloco. É um achado real, encontrado
durante a construção deste material, e a plateia sente isso.

> "O banco tinha dia 4. A API devolvia dia 3. Data de calendário não tem fuso —
> converter para instante e voltar é o bug. Em pareamento de paciente, um dia de diferença
> é identidade trocada."

---

### 11:35 — Fechamento *(slides 24–29, 25 min)*

**Slide 24 · passo 06 — `S`.** O documento para o fornecedor.

**Slide 25 · passo 07 — `S`.** `/opsx:archive`. A pergunta que fecha o argumento:
*daqui a dois anos, onde alguém encontra por que `I` virou `unknown`?*

**Slide 26 — o que fazer na segunda.** Leia os cinco itens devagar. É o que eles levam.

**Slide 27 — Dona Terezinha de novo.** O fecho emocional. Deixe respirar.

> "Interoperabilidade não é sobre sistemas. O padrão é o meio. A pessoa é o ponto."

**Slides 28–29 — obrigado, repositório, contato.** Q&A até 12h.

---

## Se der errado

| Sintoma | O que fazer |
|---|---|
| `S` falha com `Failed to authenticate` | Sessão do Claude Code expirou. Rode `claude` num terminal, autentique, tente de novo. Se estiver no palco, vá de REPLAY. |
| Passo travado ou lento demais | `Esc`, `R`, `S`. Sem explicar, sem pedir desculpa. |
| Sem gravação para o passo | O painel diz qual comando rodar. No palco, pule para o slide seguinte e siga. |
| Runner não sobe: porta em uso | Ele mesmo sugere `--port 4174`. Abra a nova porta no navegador. |
| Contêiner caiu | `docker compose -f legacy-db/docker-compose.yml up -d`. Leva segundos. |
| Internet caiu | REPLAY é 100% offline e o Postgres é local. Só o modo LIVE precisa de rede. |
| Projetor cortando o slide | O deck foi testado sem transbordo em 1280×720 e 1920×1080. Se cortar, `Ctrl` `-` no navegador. |

## Como restaurar o estado inicial

Para ensaiar de novo do zero, ou para preparar o palco:

```bash
git checkout palco-inicio
```

Se um passo falhar no palco e você precisar do resultado pronto para seguir:

```bash
git checkout main -- openspec fhir-facade
```

## Números para ter na ponta da língua

| | |
|---|---|
| Pacientes na base | 200 |
| Sem CPF | 31 · 15,5% |
| **Sem CPF e sem CNS** | **7 · 3,5%** |
| `tp_sexo = 'I'` | 6 · 3% |
| Sem `dt_atualizacao` | 14 · 7% |
| Com nome social | 10 · 5% |
| Testes | 78 |
| Cobertura | 97,2% |
| Pacientes com erro de conformidade | 0 |
