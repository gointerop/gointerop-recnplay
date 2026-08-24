# Documento de Arquitetura — Ambiente Atual

| | |
|---|---|
| **Instituição** | Hospital Santa Aurora |
| **Autoria** | Coordenação de TI — Cláudia Menezes |
| **Revisão** | v2.1 — 19/07/2026 |
| **Classificação** | Interno — compartilhado com VitaFlow sob NDA |

---

## 1. Panorama

O Santa Aurora opera com o **SIGH 4.2.1** (Medsys Sistemas Ltda.) como sistema de gestão hospitalar desde 2013, quando migrou do sistema anterior (Hospnet, descontinuado). O SIGH concentra cadastro de pacientes, agendamento, internação, faturamento e prontuário.

Não há barramento de integração. Toda integração existente hoje é ponto a ponto, via arquivo ou via acesso direto ao banco.

## 2. Topologia

```
                          ┌──────────────────────────┐
                          │   Rede administrativa    │
                          │      10.20.0.0/16        │
                          └────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼────────┐            ┌────────▼─────────┐          ┌─────────▼────────┐
│  SIGH APP      │            │  SIGH DB         │          │  SIGH DB         │
│  (Delphi +     │───────────▶│  PostgreSQL 12   │─────────▶│  RÉPLICA (RO)    │
│   web legado)  │   escrita  │  10.20.4.10      │  stream  │  10.20.4.11      │
│  10.20.4.20    │            │  PRODUÇÃO        │  replic. │  leitura apenas  │
└───────┬────────┘            └──────────────────┘          └─────────┬────────┘
        │                                                             │
        │ REST/XML                                                    │ SELECT
        │ porta 8480                                                  │
┌───────▼────────┐                                          ┌─────────▼────────┐
│  API SIGH      │                                          │  BI / Pentaho    │
│  (WSO2 legado) │                                          │  (consumidor     │
│  10.20.4.25    │                                          │   atual)         │
└────────────────┘                                          └──────────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │  DMZ — VPN IPsec         │
                          │  parceiros externos      │
                          └──────────────────────────┘
```

## 3. Componentes

### 3.1 SIGH DB — produção

- PostgreSQL **12.14** (fim de suporte da comunidade; upgrade previsto para 2027)
- Schema principal: `sigh`
- Encoding UTF-8
- **Constraints de integridade referencial foram removidas em 2021** por decisão do fornecedor, alegando degradação de performance na carga noturna de faturamento. As tabelas filhas não têm FK para `paciente`.
- Volume atual do cadastro: aproximadamente 480 mil pacientes em produção

### 3.2 SIGH DB — réplica somente leitura

- Replicação por streaming, defasagem típica menor que 5 segundos
- Endereço: `10.20.4.11:5432`
- É o ponto de acesso **autorizado** para a integração VitaFlow
- Usuário criado em 19/07: `integracao_ro`, com `SELECT` no schema `sigh`
- **Nenhuma escrita é possível por este caminho** — a réplica é fisicamente read-only

### 3.3 API SIGH

- Exposta pelo SIGH APP em `http://10.20.4.25:8480/sigh-api`
- Middleware WSO2 legado, sem manutenção ativa desde 2023
- Retorno em **XML**, não JSON
- Sem autenticação por token — usa Basic Auth com credencial de serviço compartilhada
- Documentação em `evidencias/04-api-fornecedor-medsys.md`, com data de 2021
- **Chamado aberto desde 2023 sobre falha de paginação acima de 1000 registros** (ticket MEDSYS-8841, sem previsão)

### 3.4 Conectividade com o VitaFlow

- Túnel **VPN IPsec site-to-site** entre o Santa Aurora e a VPC da VitaFlow
- A integração roda **dentro do perímetro do hospital**, na DMZ
- Nenhum dado de paciente atravessa a internet pública sem o túnel

## 4. Decisão de acesso

> **DA-01** — A integração VitaFlow acessará o cadastro de pacientes pela **réplica somente leitura** (`10.20.4.11`), e não pela API SIGH.
>
> **Justificativa:** a API não tem cobertura funcional confirmada para endereço na versão em produção, tem defeito conhecido de paginação, retorna XML e está sem manutenção. A réplica oferece o dado completo, sem risco de escrita e sem carga sobre a produção.
>
> **Ressalva:** a Medsys recomendou formalmente o uso da API (registrado em ata de 14/07). O hospital assume a decisão.
>
> **Consequência aceita:** o acoplamento passa a ser ao **modelo de dados** do fornecedor, e não a um contrato de API. Mudanças de schema em atualização do SIGH podem quebrar a integração. Mitigação: testes de contrato contra o schema, executados a cada atualização do SIGH.

## 5. Restrições

| ID | Restrição |
|---|---|
| **RA-01** | Nenhuma escrita no SIGH, por qualquer caminho. |
| **RA-02** | Nenhuma alteração de schema, índice, trigger ou view no banco do fornecedor. Isso invalida o contrato de suporte da Medsys. |
| **RA-03** | Nenhuma cópia persistente do cadastro fora do perímetro do hospital. Cache em memória com TTL curto é aceitável; base espelhada não é. |
| **RA-04** | A integração deve funcionar sem privilégio administrativo no banco — apenas `SELECT` no schema `sigh`. |
| **RA-05** | Toda a comunicação externa passa pelo túnel VPN. |

## 6. Ambiente de homologação disponibilizado

Para o desenvolvimento, o hospital disponibilizou uma cópia do schema com **dados sintéticos**, executável localmente:

- PostgreSQL 17 em contêiner
- Schema `sigh` idêntico ao de produção
- 200 pacientes gerados artificialmente, preservando as distribuições reais de preenchimento
- Porta local `55432`, usuário `sigh_app` / `sigh_app`, usuário de leitura `integracao_ro` / `integracao_ro`

> ⚠️ A base de homologação usa PostgreSQL 17 enquanto a produção roda 12.14. Recursos exclusivos de versões acima da 12 não devem ser usados na consulta.

## 7. Pendências arquiteturais em aberto

1. **Estratégia de sincronização incremental** — depende da confiabilidade de `dt_atualizacao`, que está em questão (ver ata de 14/07, 14:13:40).
2. **Estratégia de identificação do paciente** — depende do resultado do encaminhamento #3, não entregue.
3. **Comportamento diante de registro sem identificador de negócio** — não definido.
4. **Política de cache** — TTL não definido.
