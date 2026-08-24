# Documento de Requisitos — Integração de Cadastro de Pacientes

| | |
|---|---|
| **Produto** | VitaFlow — Jornada do Paciente |
| **Épico** | VF-412 · Integração Santa Aurora |
| **Autora** | Renata Albuquerque (Gerente de Produto) |
| **Revisão** | v0.3 — 21/07/2026 |
| **Status** | ⚠️ Em revisão — não aprovado pela engenharia |

---

## 1. Contexto de negócio

O VitaFlow é um aplicativo de jornada do paciente. Hoje o paciente do Hospital Santa Aurora precisa se cadastrar do zero no nosso app, redigitando dados que o hospital já tem. Isso gera abandono de 41% no onboarding (dado do funil de junho/2026).

A integração com o cadastro do hospital elimina essa fricção: o paciente informa um documento, a gente reconhece que ele já é paciente da instituição e traz os dados básicos.

**Meta:** reduzir o abandono de onboarding de 41% para menos de 15%.

**Marco fixo:** demonstração para o board em **28/08/2026**.

## 2. Escopo

### Dentro do escopo

- Leitura do cadastro de pacientes do sistema SIGH (fornecedor Medsys)
- Exposição desses dados num padrão de interoperabilidade consumível pelo app
- Busca de paciente por documento, por nome e por data de nascimento
- Sincronização periódica de alterações

### Fora do escopo (v1)

- Escrita / cadastro de paciente pelo VitaFlow
- Agendamento, prontuário, resultados de exame, faturamento
- Qualquer recurso além de paciente

## 3. Requisitos funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-01** | O sistema deve permitir consultar um paciente pelo seu identificador único no hospital. | Must |
| **RF-02** | O sistema deve permitir buscar pacientes por CPF. | Must |
| **RF-03** | O sistema deve permitir buscar pacientes por nome, com correspondência parcial e insensível a acentuação. | Must |
| **RF-04** | O sistema deve permitir buscar pacientes por data de nascimento. | Should |
| **RF-05** | O sistema deve retornar, para cada paciente: nome de registro, nome social, data de nascimento, sexo, telefone de contato e endereço. | Must |
| **RF-06** | Quando o paciente possuir nome social, a interface deve exibir o nome social. O nome de registro deve continuar disponível para emissão de documentos. | Must |
| **RF-07** | O sistema deve permitir recuperar apenas os pacientes alterados desde um determinado instante, para sincronização incremental. | Must |
| **RF-08** | O sistema deve indicar se o cadastro do paciente está ativo. | Should |
| **RF-09** | O sistema deve expor documentação navegável da interface para consumo por terceiros. | Should |

## 4. Requisitos não funcionais

| ID | Requisito |
|---|---|
| **RNF-01** | O padrão de interoperabilidade adotado será **HL7 FHIR R4**. |
| **RNF-02** | A integração é **somente leitura**. Nenhum dado é gravado no SIGH. |
| **RNF-03** | Nenhum dado clínico é copiado ou persistido fora do hospital. A consulta é feita ao vivo contra a base de origem. |
| **RNF-04** | Tempo de resposta de uma consulta por identificador: até 800 ms no percentil 95. |
| **RNF-05** | CPF não pode aparecer em URL, log de aplicação ou log de acesso. |
| **RNF-06** | Todo acesso a dado de paciente deve ser registrado em trilha de auditoria. |
| **RNF-07** | Cobertura de testes automatizados de no mínimo 90%. |
| **RNF-08** | Os recursos produzidos devem passar em validação de conformidade contra o padrão adotado. |

## 5. Premissas

> As premissas abaixo foram levantadas na reunião de kickoff de 14/07 e **ainda não foram verificadas contra o dado real**.

| ID | Premissa | Origem | Verificada? |
|---|---|---|---|
| **P-01** | Todo paciente do Santa Aurora possui CPF cadastrado. | Kickoff 14/07 (RA) | ❌ Não |
| **P-02** | O CPF é chave única e suficiente para identificar o paciente. | Kickoff 14/07 (RA) | ❌ Não |
| **P-03** | O campo `dt_atualizacao` reflete confiavelmente a última alteração do registro. | Kickoff 14/07 (WB) | ❌ Não — contestada por DS |
| **P-04** | A API do fornecedor devolve endereço na versão 4.2.1. | Kickoff 14/07 (WB) | ❌ Não — encaminhamento #4 sem resposta |
| **P-05** | O acesso será feito por réplica somente leitura do banco. | Kickoff 14/07 (CM) | ✅ Sim — usuário criado em 19/07 |

## 6. Restrições de proteção de dados

Levantadas por Paulo Rezende (DPO) em 14/07:

- **PD-01** — Base legal: art. 11, II, "f" da LGPD (tutela da saúde). Aplicável ao escopo desta integração.
- **PD-02** — Princípio da minimização: o payload deve conter apenas o necessário à finalidade declarada.
- **PD-03** — **Nome da mãe** só pode trafegar quando houver finalidade declarada de desambiguação de homônimo. Não pode ser campo padrão do retorno.
- **PD-04** — CPF proibido em URL e em log.

## 7. Critérios de aceite da demonstração de 28/08

1. Consultar um paciente conhecido pelo identificador e ver os dados corretos
2. Buscar por nome parcial e obter resultado
3. Exibir um paciente com nome social e comprovar que o nome social aparece
4. Mostrar a documentação navegável da interface
5. Mostrar o relatório de cobertura de testes acima de 90%
6. Mostrar o resultado da validação de conformidade

---

## Comentários de revisão

> **Diego Sampaio — 21/07, 09:14**
> Não aprovo a v0.3 como está. P-01 e P-02 são premissas, não requisitos, e o documento trata as duas como fato consumado em RF-02. Precisamos rodar a contagem no banco antes. Se houver paciente sem CPF, RF-02 sozinho não atende RF-01 e a estratégia de identificação muda.

> **Renata Albuquerque — 21/07, 10:02**
> Diego, entendo, mas a gente não pode parar o desenvolvimento esperando o encaminhamento #3 que a Cláudia não entregou. Segue com CPF e a gente trata exceção depois.

> **Diego Sampaio — 21/07, 10:20**
> "Tratar exceção depois" em identificação de paciente é como a gente mistura prontuário. Registrando minha discordância formal aqui.
