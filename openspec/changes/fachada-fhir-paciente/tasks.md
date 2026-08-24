## 1. Esqueleto do projeto

- [ ] 1.1 Criar `fhir-facade/` com Maven, parent `spring-boot-starter-parent` 4.1.1 e Java 25
- [ ] 1.2 Declarar HAPI FHIR 8.10.1 (`structures-r4`, `server`, `server-openapi`, `validation`, `validation-resources-r4`), `spring-boot-starter-web`, `spring-boot-starter-jdbc` e driver PostgreSQL 42.7.13
- [ ] 1.3 Configurar JaCoCo 0.8.15 com regra de cobertura mínima de 90% que quebra o build
- [ ] 1.4 Configurar a conexão com o SIGH usando o usuário `integracao_ro`, somente `SELECT`

## 2. Acesso ao dado legado

- [ ] 2.1 Escrever a consulta única com `LEFT JOIN` entre `paciente`, `paciente_contato`, `paciente_endereco` e `municipio_ibge`
- [ ] 2.2 Implementar o repositório com `JdbcTemplate`, agrupando as linhas por `cd_paciente`
- [ ] 2.3 Tratar toda junção de forma defensiva: ausência de linha filha é caso normal
- [ ] 2.4 Resolver endereço principal de forma determinística quando houver mais de um marcado

## 3. Conversão para FHIR R4

- [ ] 3.1 Mapear identificação lógica a partir de `cd_paciente`
- [ ] 3.2 Mapear CPF e CNS para `identifier`, omitindo os ausentes
- [ ] 3.3 Mapear nome social para `use = usual` e nome civil para `use = official`
- [ ] 3.4 Mapear `tp_sexo` para `gender`, com `I` resultando em `unknown`
- [ ] 3.5 Mapear `st_ativo` para `active` e `dt_obito` para `deceasedDateTime`, de forma independente
- [ ] 3.6 Normalizar telefone para apenas dígitos, removendo o código do país
- [ ] 3.7 Mapear endereço, omitindo elementos sem valor na origem
- [ ] 3.8 Derivar `meta.lastUpdated` de `COALESCE(dt_atualizacao, dt_cadastro)`
- [ ] 3.9 Garantir que `nm_mae` não apareça em nenhum elemento do recurso
- [ ] 3.10 Isolar a conversão por paciente: falha individual não interrompe o resultado

## 4. Servidor FHIR

- [ ] 4.1 Registrar `RestfulServer` do HAPI com o `IResourceProvider` de `Patient`
- [ ] 4.2 Implementar `read` por `_id`
- [ ] 4.3 Implementar busca por `identifier`, aceitando valor com e sem system
- [ ] 4.4 Implementar busca por `name`, parcial, sem caixa e sem acento, cobrindo nome civil e social
- [ ] 4.5 Implementar busca por `birthdate` com os prefixos `gt`, `lt`, `ge` e `le`
- [ ] 4.6 Implementar busca por `_lastUpdated`
- [ ] 4.7 Garantir que nenhuma interação de escrita seja exposta
- [ ] 4.8 Registrar `OpenApiInterceptor` para servir a documentação navegável
- [ ] 4.9 Suprimir CPF e CNS de todo log, e recusar CPF como segmento de caminho

## 5. Testes

- [ ] 5.1 Testes unitários da normalização de telefone, cobrindo os seis formatos da origem
- [ ] 5.2 Testes unitários do conversor, um por scenario da spec
- [ ] 5.3 Testes de integração com Testcontainers, aplicando as migrations do `legacy-db/`
- [ ] 5.4 Teste do paciente sem CPF e sem CNS, verificando ausência de `identifier` e recurso válido
- [ ] 5.5 Teste do paciente com nome social, verificando `usual` e `official`
- [ ] 5.6 Teste de `_lastUpdated` alcançando registro sem `dt_atualizacao`
- [ ] 5.7 Teste confirmando que operação de escrita é rejeitada
- [ ] 5.8 Validação de conformidade de toda a base de homologação, sem issue `error` ou `fatal`
- [ ] 5.9 Atingir cobertura de 90% com o build quebrando abaixo disso

## 6. Entrega

- [ ] 6.1 Verificar `/metadata` e a documentação navegável
- [ ] 6.2 Escrever o documento de integração para o fornecedor, com o de-para completo, as divergências levantadas e os riscos abertos
- [ ] 6.3 Rodar `mvn verify` do zero e confirmar o build verde
