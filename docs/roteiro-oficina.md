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
- [ ] **Deixar a auto-atualização terminar.** O runner imprime a versão do `claude` ao subir.
      Se ele avisar que a instalação está incompleta, rode
      `npm install -g @anthropic-ai/claude-code@latest` e suba de novo. Uma atualização pega
      pela metade some com o executável e o modo LIVE para.
- [ ] `docker compose -f legacy-db/docker-compose.yml up -d` e confirmar 200 pacientes
- [ ] `cd fhir-facade && mvn -B verify` — build verde de ponta a ponta
- [ ] `node tools/run-step.mjs --list` — **todos os sete passos devem estar gravados**
- [ ] Ensaio integral em REPLAY **com o Wi-Fi desligado**
- [ ] Fonte do terminal em 18pt ou mais; deck testado na resolução do projetor
- [ ] Bateria carregada, fonte na mochila, roteador 4G próprio

### Manhã do dia (28/08, até 8h40)

- [ ] Docker aberto e contêiner de pé **60 minutos antes** — não deixe para 8h55
- [ ] `node deck/runner.mjs` e abrir `http://localhost:4173`
- [ ] Verificar que o painel lateral abre no slide 20 (primeiro passo)
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

### 09:00 — Abertura *(slides 1–6, 14 min)*

**Slide 1 — capa.** Aponte para a fileira de personas. Elas voltam no fim.

**Slide 2 — quem somos.** *Software interoperability house*, três pessoas, três jurisdições,
100% pernambucana. A frase: **interoperabilidade não é problema de tamanho de time, é problema
de saber onde olhar.**

**Slide 3 — de onde viemos.** UFPE, Núcleo de Telessaúde, e "uma das maiores empresas de saúde
digital do Brasil, que também é daqui". **Não diga o nome.** Faça a pausa — a sala vai completar
sozinha, e o efeito é melhor do que dizer.

**Slide 4 — com quem trabalhamos.** Mencione que o Real Hospital Português é logo ali.

**Slide 5 — o mapa.** Quatro etapas, uma por `→`. Não corra:

1. **20** — Foundational Implementer. "Vinte pessoas em cinco países da América Latina."
2. **11** — Proficient
3. **7** — Advanced Developer
4. **2** — Advanced Architect. **Pare aqui.**

Deixe o mapa quase vazio na tela por alguns segundos antes de falar. Então:

> "Sobraram dois em todo o continente. Um dos dois está aqui — e é daqui."

Se alguém perguntar por que não acha a categoria no diretório da HL7, a resposta está no próprio
slide: a credencial Advanced Architect ainda não é filtrável lá. **Diga isso antes de alguém
perguntar** — está escrito na tela justamente para isso.

**Slide 6 — o combinado.**

> "Nas próximas três horas a gente não vai falar sobre integração. A gente vai fazer uma.
> Do zero. Com o código nascendo na tela. E tudo o que aparecer aqui vai estar no
> repositório quando vocês saírem." 

---

### 09:14 — Por que integração em saúde falha *(slides 7–9, 16 min)*

**Slide 7 — as duas integrações mortas.** Conte como história, não como estatística.
Deixe o silêncio depois de *"na terceira vez a diretoria cancelou"*.

**Slide 8 — as cinco fontes.** Este é o slide que sustenta a oficina inteira.
Pergunte à plateia, de verdade: *"quem aqui já achou o de-para numa planilha que ninguém
sabia quem mantinha?"* Espere as mãos.

**Slide 9 — o custo.** A frase que fica: **a divergência sempre aparece, você só escolhe quando.**

---

### 09:30 — Spec Engineering *(slides 10–14, 20 min)*

**Slide 10** — a definição. **Slide 11** — a tabela contra prompt direto. Aqui a plateia de
startup entende o argumento: *agente rápido sem spec não acelera o projeto, acelera o retrabalho*.

**Slide 12** — leia o requirement em voz alta, inteiro. É a primeira vez que eles veem a forma.

**Slide 13** — o ciclo. Enfatize que `/opsx:propose` **para** antes de implementar. A fronteira
é do método, não da disciplina de quem está cansado às onze da noite.

**Slide 14 — anatomia de uma change.** O slide anterior nomeia os quatro arquivos; este diz o que
cada um guarda. Passe pelas quatro perguntas — por quê, o quê, como, em que ordem — e pare no
`design.md`:

> "Repare que o design guarda a alternativa que foi **recusada**, e o porquê. É o que ninguém
> escreve, e é justamente o que a próxima pessoa precisa saber."

Vale porque, daqui a vinte minutos, esses arquivos vão aparecer nascendo no painel da DEMO 1 —
e a plateia já vai saber o que está vendo.

---

### 09:50 — As evidências *(slides 15–19, 12 min)*

**Slide 15 — o disclaimer.** Trinta segundos, sem pressa e sem piada. Nomes fictícios, dados
sintéticos, documentos escritos para o exercício. Fecha com a frase que emenda no caso:
*os nomes são fictícios, os problemas não.*

**Slides 16 a 18 — o caso.** Abra os arquivos de verdade em `evidencias/` se der tempo. Se não
der, os slides bastam.

No slide 17, aponte as datas: **o documento mais confiante é o mais antigo.**
No slide 18, a pergunta: *"reconheceu o seu banco?"*

**Slide 19 — para reproduzir em casa.** Um minuto, não mais. Quem quiser acompanhar tem a demo
inteira para instalar. A frase que importa não é a lista:

> "Ou não instale nada na mão. Cola o runbook no seu agente e deixa ele montar o ambiente —
> que é, aliás, exatamente o que a gente vai fazer com o resto do projeto nas próximas duas horas."

Emenda direto na DEMO 1.

---

### 10:02 — DEMO 1 *(slides 20–25, 28 min)*

**Slide 20 · passo 01 — `S`.** Enquanto roda, narre o que o agente está fazendo. Não fique em
silêncio olhando o painel.

**Slide 21 — PARE.** Este é o momento da oficina. Não corra.

1. Leia a tabela das quatro fontes, uma por uma, em voz alta
2. Rode a query ao vivo, num terminal ao lado
3. Deixe o número aparecer

> "A ata errou. O requisito errou. E o dicionário do fornecedor — que é o documento mais
> formal dos três — também errou. Só o dado estava certo."

**Slide 22 — Dona Terezinha.** Aqui o número vira gente. Vá devagar.

> "São sete pessoas. E nenhuma das cinco evidências menciona que elas existem."

**Slide 23 — as outras personas.** Mais rápido, é reforço.

**Slide 24 · passo 02 — `S`.** O agente propõe e **pergunta** sobre a identificação.
Se ele perguntar, comemore: é exatamente o comportamento que a oficina defende.

*(Se o passo 03 couber antes de 10:30, rode. Se não, ele abre o bloco depois do intervalo.)*

---

### 10:30 — Intervalo *(slide 26, 15 min)*

Deixe o slide na tela. Aproveite para conferir que o contêiner segue de pé.

---

### 10:45 — DEMO 2 *(slides 27–28, 30 min)*

**Slide 27 — fachada, não repositório.** Trinta segundos de conceito antes de rodar.
A frase: *migração costuma ser a resposta cara para a pergunta errada.*

**Slide 28 · passo 04.** ⚠️ **Leia isto antes do dia.**

O ensaio mediu: **este passo leva 35 minutos ao vivo** — 105 chamadas de ferramenta para construir
a fachada inteira. O bloco tem 30. **Ao vivo ele não cabe**, e assistir 35 minutos de saída de
agente é ruim de plateia mesmo quando cabe.

**Modo recomendado: REPLAY.** Aperte `R` e depois `S`. A gravação reproduz os 35 minutos em cerca
de dois, e sobram vinte e cinco para o que vale mais — abrir o que foi construído e explicar.
Enquanto roda:

- aponte os arquivos aparecendo na árvore lateral
- comente que os testes nascem junto com o código, não depois

O REPLAY reproduz o stream, mas não executa nada — nenhum arquivo nasceria. Por isso, ao terminar,
o runner **materializa** `openspec/` e `fhir-facade/` a partir da `main`, e você vê os arquivos
chegarem na árvore lateral. É o que faz o passo 05 seguinte, que roda `mvn verify` de verdade,
ter o que verificar. Testado de ponta a ponta: palco vazio, replay, build verde.

Terminado o replay, use o tempo que sobrou para abrir de verdade:

- `PatientMapper.java` — cada decisão da spec virou um método, com a evidência no comentário
- `PacienteRepository.java` — o `nm_mae` que não é sequer selecionado
- os testes — um por scenario

**Se quiser mesmo ao vivo**, há um jeito: o runner é independente da navegação. Por volta de
**10:28, antes do intervalo**, pule para este slide, aperte `S`, e volte para o slide do intervalo.
O agente roda durante os 15 minutos de pausa e, às 10:45, você volta com a fachada pronta e
percorre o resultado. Custa a cena dos arquivos nascendo, mas o build é genuinamente ao vivo.

---

### 11:15 — DEMO 3 *(slides 29–30, 20 min)*

**Slide 29 · passo 05 — `S`.** O build fechando verde. Mostre a cobertura e a validação.

**Slide 30 — o bug do fuso.** Guarde este para o fim do bloco. É um achado real, encontrado
durante a construção deste material, e a plateia sente isso.

> "O banco tinha dia 4. A API devolvia dia 3. Data de calendário não tem fuso —
> converter para instante e voltar é o bug. Em pareamento de paciente, um dia de diferença
> é identidade trocada."

---

### 11:35 — Fechamento *(slides 31–37, 25 min)*

**Slide 31 · passo 06 — `S`.** O documento para o fornecedor.

**Slide 32 · passo 07 — `S`.** `/opsx:archive`. A pergunta que fecha o argumento:
*daqui a dois anos, onde alguém encontra por que `I` virou `unknown`?*

**Slide 33 — o que fazer na segunda.** Leia os cinco itens devagar. É o que eles levam.

**Slide 34 — cada projeto vira uma ilha.** A ponte do método para o produto. A frase:

> "A spec resolve isso dentro de um projeto. Fazer valer entre projetos é governança de
> interoperabilidade — e é aí que a gente entra."

**Slide 35 — a escada.** Seis degraus, um por `→`. **Não é catálogo, é escada:** cada produto
resolve um problema, e resolver esse problema revela o próximo. Leia o problema em voz alta antes
de acender a resposta — é o problema que prende, não o nome do produto.

1. *"Os sistemas não se falam."* → **aiconnect**
2. *"Agora falam. Mas cada projeto fala um dialeto."* → **ignite**
3. *"O dado está certo. Mas ninguém vê o paciente inteiro."* → **gocare**, com o IAGO dentro
4. *"Vemos tudo. Mas quem autorizou?"* → **goconsent**
5. *"E quem está do outro lado da API?"* → **gopass**
6. O fecho: **alfred**

No último degrau a escada inteira está na tela. Aponte para ela — **essa pilha é a plataforma**.
E feche amarrando de volta às três horas anteriores:

> "O ALFRED usa as APIs da própria instituição, por MCP, para gerar insight sobre os dados dela.
> Os dados nunca saem da instituição — que é exatamente o que a gente fez hoje de manhã com a
> fachada: traduzir sem copiar."

Emenda direto na Dona Terezinha.

**Slide 36 — Dona Terezinha de novo.** O fecho emocional. Deixe respirar.

> "Interoperabilidade não é sobre sistemas. O padrão é o meio. A pessoa é o ponto."

**Slide 37 — obrigado, repositório, contato.** Q&A até 12h.

---

## Se der errado

| Sintoma | O que fazer |
|---|---|
| `S` falha com `Failed to authenticate` | Sessão do Claude Code expirou. Rode `claude` num terminal, autentique, tente de novo. Se estiver no palco, vá de REPLAY. |
| O runner avisa que a instalação do Claude Code está incompleta | Auto-atualização interrompida deixou só `claude.exe.old.*` no diretório `bin`. Conserto: `npm install -g @anthropic-ai/claude-code@latest`. No palco, vá de REPLAY. |
| Passo travado ou lento demais | `Esc`, `R`, `S`. Sem explicar, sem pedir desculpa. |
| Passo 04 ao vivo passando do tempo | Era esperado: ele leva 35 min. `Esc`, `R`, `S` e siga em REPLAY. |
| Sem gravação para o passo | O painel diz qual comando rodar. No palco, pule para o slide seguinte e siga. |
| Runner não sobe: porta em uso | Ele mesmo sugere `--port 4174`. Abra a nova porta no navegador. |
| Contêiner caiu | `docker compose -f legacy-db/docker-compose.yml up -d`. Leva segundos. |
| Internet caiu | REPLAY é 100% offline e o Postgres é local. Só o modo LIVE precisa de rede. |
| O mapa não avança de etapa | O avanço é o próprio `→`. Se pulou o slide inteiro, `←` volta e recomeça pelas etapas. |
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

### Duração real de cada passo

Medido no ensaio completo de 24/08. Serve para decidir o que roda ao vivo e o que vai de REPLAY.

| Passo | Ao vivo | Ferramentas |
|---|---|---|
| 01 Ler as evidências | 4,6 min | 23 |
| 02 Propor a mudança | 1,2 min | 4 |
| 03 Decidir a identificação | 7,5 min | 13 |
| **04 Implementar a fachada** | **34,9 min** | **105** |
| 05 Verificar e fechar o verde | 5,8 min | 15 |
| 06 Documentar para o fornecedor | 7,3 min | 14 |
| 07 Arquivar | 2,1 min | 11 |
| **Total** | **64 min** | **185** |

Uma rodada completa ao vivo custa cerca de **US$ 33** em tokens.

### Certificação FHIR na América Latina

Diretório da HL7, consultado em 24/08/2026. Pessoas distintas, não linhas de certificação.
Consultados: Brasil, Argentina, Chile, Colômbia e Peru.

| Nível | Total |
|---|---|
| Foundational Implementer | 20 |
| R4 / STU3 Proficient | 11 |
| Advanced Developer | 7 |
| **Advanced Architect** | **2** |
