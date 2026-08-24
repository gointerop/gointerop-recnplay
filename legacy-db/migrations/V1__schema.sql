SET client_encoding = 'UTF8';

-- =====================================================================
-- SIGH — Sistema Integrado de Gestão Hospitalar
-- Fornecedor: Medsys Sistemas Ltda.
-- Módulo: Cadastro de Pacientes
-- Versão do modelo: 4.2.1 (2019-11-08)
--
-- ATENÇÃO: este DDL é o que o fornecedor entregou. Não há constraints
-- de integridade referencial no ambiente de produção do cliente — elas
-- foram removidas em 2021 por questão de performance de carga.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS sigh;

-- ---------------------------------------------------------------------
-- Tabela mestre de pacientes
-- ---------------------------------------------------------------------
CREATE TABLE sigh.paciente (
    cd_paciente     INTEGER      NOT NULL,
    nm_paciente     VARCHAR(120) NOT NULL,   -- nome de registro civil
    nm_social       VARCHAR(120),            -- nome social (Lei 18.911/2021)
    dt_nascimento   DATE,
    tp_sexo         CHAR(1),                 -- ver sigh.de_para_dominio, domínio SEXO
    nr_cpf          VARCHAR(11),             -- somente dígitos, sem máscara
    nr_cns          VARCHAR(15),             -- Cartão Nacional de Saúde
    nm_mae          VARCHAR(120),
    st_ativo        CHAR(1) DEFAULT 'S',     -- S = ativo, N = inativo
    dt_obito        DATE,
    dt_cadastro     TIMESTAMP,
    dt_atualizacao  TIMESTAMP,
    CONSTRAINT pk_paciente PRIMARY KEY (cd_paciente)
);

COMMENT ON TABLE  sigh.paciente               IS 'Cadastro mestre de pacientes do SIGH';
COMMENT ON COLUMN sigh.paciente.nr_cpf        IS 'CPF sem máscara. Cadastros anteriores a 2015 podem não ter CPF.';
COMMENT ON COLUMN sigh.paciente.tp_sexo       IS 'Domínio SEXO em sigh.de_para_dominio';
COMMENT ON COLUMN sigh.paciente.st_ativo      IS 'N indica cadastro desativado administrativamente. Não implica óbito.';
COMMENT ON COLUMN sigh.paciente.dt_atualizacao IS 'Atualizado por trigger da aplicação. Pode estar nulo em carga histórica.';

-- ---------------------------------------------------------------------
-- Contatos (telefone / e-mail)
-- ---------------------------------------------------------------------
CREATE TABLE sigh.paciente_contato (
    cd_contato   INTEGER      NOT NULL,
    cd_paciente  INTEGER      NOT NULL,
    tp_contato   CHAR(3),                    -- RES | CEL | COM | EML
    ds_contato   VARCHAR(120),
    st_principal CHAR(1) DEFAULT 'N',
    CONSTRAINT pk_paciente_contato PRIMARY KEY (cd_contato)
);

COMMENT ON COLUMN sigh.paciente_contato.ds_contato IS 'Telefone gravado como texto livre. Formato NÃO é normalizado.';

-- ---------------------------------------------------------------------
-- Endereços
-- ---------------------------------------------------------------------
CREATE TABLE sigh.paciente_endereco (
    cd_endereco       INTEGER      NOT NULL,
    cd_paciente       INTEGER      NOT NULL,
    ds_logradouro     VARCHAR(150),
    nr_numero         VARCHAR(10),           -- texto: aceita 'S/N'
    ds_complemento    VARCHAR(60),
    nm_bairro         VARCHAR(80),
    cd_municipio_ibge INTEGER,
    sg_uf             CHAR(2),
    nr_cep            VARCHAR(8),
    st_principal      CHAR(1) DEFAULT 'N',
    CONSTRAINT pk_paciente_endereco PRIMARY KEY (cd_endereco)
);

-- ---------------------------------------------------------------------
-- Tabela de municípios (subconjunto da tabela do IBGE)
-- ---------------------------------------------------------------------
CREATE TABLE sigh.municipio_ibge (
    cd_municipio_ibge INTEGER      NOT NULL,
    nm_municipio      VARCHAR(80)  NOT NULL,
    sg_uf             CHAR(2)      NOT NULL,
    CONSTRAINT pk_municipio_ibge PRIMARY KEY (cd_municipio_ibge)
);

-- ---------------------------------------------------------------------
-- De-para de domínios internos do SIGH
-- Mantida manualmente pela equipe do fornecedor.
-- ---------------------------------------------------------------------
CREATE TABLE sigh.de_para_dominio (
    cd_dominio VARCHAR(20)  NOT NULL,
    cd_valor   VARCHAR(10)  NOT NULL,
    ds_valor   VARCHAR(60)  NOT NULL,
    CONSTRAINT pk_de_para_dominio PRIMARY KEY (cd_dominio, cd_valor)
);

-- ---------------------------------------------------------------------
-- Índices de produção
-- ---------------------------------------------------------------------
CREATE INDEX ix_paciente_cpf         ON sigh.paciente (nr_cpf);
CREATE INDEX ix_paciente_cns         ON sigh.paciente (nr_cns);
CREATE INDEX ix_paciente_nome        ON sigh.paciente (nm_paciente);
CREATE INDEX ix_paciente_atualizacao ON sigh.paciente (dt_atualizacao);
CREATE INDEX ix_contato_paciente     ON sigh.paciente_contato (cd_paciente);
CREATE INDEX ix_endereco_paciente    ON sigh.paciente_endereco (cd_paciente);

-- ---------------------------------------------------------------------
-- Usuário somente-leitura liberado para integrações externas
-- ---------------------------------------------------------------------
CREATE USER integracao_ro WITH PASSWORD 'integracao_ro';
GRANT USAGE ON SCHEMA sigh TO integracao_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA sigh TO integracao_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA sigh GRANT SELECT ON TABLES TO integracao_ro;
