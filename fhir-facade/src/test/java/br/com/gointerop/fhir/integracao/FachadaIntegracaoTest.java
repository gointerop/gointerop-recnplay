package br.com.gointerop.fhir.integracao;

import br.com.gointerop.fhir.fhir.Sistemas;
import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.client.api.IGenericClient;
import ca.uhn.fhir.rest.gclient.TokenClientParam;
import ca.uhn.fhir.rest.server.exceptions.InvalidRequestException;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import ca.uhn.fhir.validation.FhirValidator;
import ca.uhn.fhir.validation.ValidationResult;
import org.hl7.fhir.common.hapi.validation.support.CommonCodeSystemsTerminologyService;
import org.hl7.fhir.common.hapi.validation.support.InMemoryTerminologyServerValidationSupport;
import org.hl7.fhir.common.hapi.validation.support.ValidationSupportChain;
import org.hl7.fhir.common.hapi.validation.validator.FhirInstanceValidator;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.CapabilityStatement;
import org.hl7.fhir.r4.model.HumanName;
import org.hl7.fhir.r4.model.Patient;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integracao contra o schema real do fornecedor.
 *
 * <p>O contêiner aplica exatamente as mesmas migrations de {@code legacy-db/migrations},
 * e nao uma copia. E deliberado: o documento de arquitetura registra que a decisao de ir
 * ao banco em vez da API acopla a integracao ao modelo do fornecedor, e a mitigacao
 * acordada foi justamente esta — se o SIGH mudar o modelo, o build quebra aqui, e nao a
 * integracao em producao.
 *
 * <p>A conexao usa {@code integracao_ro}, o mesmo usuario somente leitura de producao.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@DisplayName("Fachada FHIR sobre o banco do SIGH")
class FachadaIntegracaoTest {

    /** Paciente com CPF e CNS. */
    private static final String COM_DOCUMENTOS = "10001";
    private static final String CPF_DE_10001 = "26716608044";
    private static final String NASCIMENTO_DE_10001 = "1940-08-04";

    /**
     * O caso dificil da base, tudo num registro so: tem nome social, nao tem CPF nem CNS,
     * nao tem {@code dt_atualizacao} e esta inativo sem obito.
     */
    private static final String CASO_DIFICIL = "10027";

    /** Paciente com acento no nome civil. */
    private static final String COM_ACENTO = "10010";

    private static final Path MIGRATIONS = Path.of("..", "legacy-db", "migrations").toAbsolutePath().normalize();

    @Container
    @SuppressWarnings("resource")
    static PostgreSQLContainer<?> sigh = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("sigh")
            .withUsername("sigh_app")
            .withPassword("sigh_app")
            .withCopyFileToContainer(
                    MountableFile.forHostPath(MIGRATIONS.resolve("V1__schema.sql")),
                    "/docker-entrypoint-initdb.d/V1__schema.sql")
            .withCopyFileToContainer(
                    MountableFile.forHostPath(MIGRATIONS.resolve("V2__seed.sql")),
                    "/docker-entrypoint-initdb.d/V2__seed.sql");

    @DynamicPropertySource
    static void configurar(DynamicPropertyRegistry registro) {
        registro.add("spring.datasource.url", sigh::getJdbcUrl);
        registro.add("spring.datasource.username", () -> "integracao_ro");
        registro.add("spring.datasource.password", () -> "integracao_ro");
    }

    @LocalServerPort
    int porta;

    private static final FhirContext CONTEXTO = FhirContext.forR4();
    private static FhirValidator validador;

    @BeforeAll
    static void prepararValidador() {
        ValidationSupportChain suporte = new ValidationSupportChain(
                new ca.uhn.fhir.context.support.DefaultProfileValidationSupport(CONTEXTO),
                new InMemoryTerminologyServerValidationSupport(CONTEXTO),
                new CommonCodeSystemsTerminologyService(CONTEXTO));
        validador = CONTEXTO.newValidator();
        validador.registerValidatorModule(new FhirInstanceValidator(suporte));
    }

    private IGenericClient cliente() {
        return CONTEXTO.newRestfulGenericClient("http://localhost:" + porta + "/fhir");
    }

    private Patient lerPaciente(String id) {
        return cliente().read().resource(Patient.class).withId(id).execute();
    }

    private Bundle buscar(ca.uhn.fhir.rest.gclient.ICriterion<?> criterio) {
        return cliente().search().forResource(Patient.class).where(criterio)
                .count(300).returnBundle(Bundle.class).execute();
    }

    @Nested
    @DisplayName("Leitura")
    class Leitura {

        @Test
        @DisplayName("paciente com CPF e CNS traz os dois identificadores")
        void pacienteComDocumentos() {
            Patient p = lerPaciente(COM_DOCUMENTOS);

            assertThat(p.getIdentifier()).extracting("system")
                    .containsExactlyInAnyOrder(Sistemas.CPF, Sistemas.CNS);
            assertThat(p.getName()).isNotEmpty();
        }

        @Test
        @DisplayName("codigo inexistente devolve 404")
        void codigoInexistente() {
            assertThatThrownBy(() -> lerPaciente("999999"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("CPF no caminho da URL e recusado")
        void cpfNaUrlRecusado() {
            assertThatThrownBy(() -> lerPaciente(CPF_DE_10001))
                    .isInstanceOf(InvalidRequestException.class);
        }
    }

    @Nested
    @DisplayName("O caso que nenhuma evidencia documentava")
    class CasoDificil {

        @Test
        @DisplayName("paciente sem CPF e sem CNS volta valido e sem identifier")
        void semIdentificadorDeNegocio() {
            Patient p = lerPaciente(CASO_DIFICIL);

            assertThat(p.hasIdentifier()).isFalse();
            assertThat(p.getIdElement().getIdPart()).isEqualTo(CASO_DIFICIL);
            assertThat(validar(p)).isEmpty();
        }

        @Test
        @DisplayName("nome social aparece como usual e o civil como official")
        void nomeSocial() {
            Patient p = lerPaciente(CASO_DIFICIL);

            assertThat(nomePorUso(p, HumanName.NameUse.USUAL)).isEqualTo("Sérgio Correia Carvalho");
            assertThat(nomePorUso(p, HumanName.NameUse.OFFICIAL)).isEqualTo("Rita Correia Carvalho");
        }

        @Test
        @DisplayName("cadastro inativo nao vira falecido")
        void inativoNaoEhFalecido() {
            Patient p = lerPaciente(CASO_DIFICIL);

            assertThat(p.getActive()).isFalse();
            assertThat(p.hasDeceased()).isFalse();
        }

        @Test
        @DisplayName("sem dt_atualizacao, o lastUpdated cai na data de cadastro")
        void lastUpdatedComFallback() {
            Patient p = lerPaciente(CASO_DIFICIL);

            // dt_cadastro deste registro e 2014-09-06. Sem o COALESCE, o recurso sairia
            // sem lastUpdated e o paciente ficaria invisivel a sincronizacao incremental.
            assertThat(p.getMeta().hasLastUpdated()).isTrue();
            assertThat(p.getMeta().getLastUpdated().toInstant())
                    .isBetween(java.time.Instant.parse("2014-09-06T00:00:00Z"),
                            java.time.Instant.parse("2014-09-07T00:00:00Z"));
        }
    }

    @Nested
    @DisplayName("Busca")
    class Busca {

        @Test
        @DisplayName("por identifier com system")
        void porIdentifier() {
            Bundle b = buscar(new TokenClientParam("identifier").exactly()
                    .systemAndCode(Sistemas.CPF, CPF_DE_10001));

            assertThat(b.getEntry()).hasSize(1);
            assertThat(((Patient) b.getEntryFirstRep().getResource()).getIdElement().getIdPart())
                    .isEqualTo(COM_DOCUMENTOS);
        }

        @Test
        @DisplayName("identificador inexistente devolve searchset vazio")
        void semResultado() {
            Bundle b = buscar(new TokenClientParam("identifier").exactly().code("00000000000"));

            assertThat(b.getType()).isEqualTo(Bundle.BundleType.SEARCHSET);
            assertThat(b.getEntry()).isEmpty();
        }

        @Test
        @DisplayName("por nome sem acento encontra o nome acentuado")
        void porNomeSemAcento() {
            Bundle b = buscar(Patient.NAME.matches().value("antonio"));

            assertThat(b.getEntry()).isNotEmpty();
            assertThat(b.getEntry()).extracting(e -> ((Patient) e.getResource()).getIdElement().getIdPart())
                    .contains(COM_ACENTO);
        }

        @Test
        @DisplayName("por nome encontra tambem pelo nome social")
        void porNomeSocial() {
            Bundle b = buscar(Patient.NAME.matches().value("Sérgio Correia"));

            assertThat(b.getEntry()).extracting(e -> ((Patient) e.getResource()).getIdElement().getIdPart())
                    .contains(CASO_DIFICIL);
        }

        @Test
        @DisplayName("por data de nascimento exata")
        void porNascimento() {
            // Valor fixado contra o banco, e nao lido da propria API: se a fachada
            // deslocar a data, o teste precisa falhar em vez de concordar consigo mesma.
            assertThat(lerPaciente(COM_DOCUMENTOS).getBirthDateElement().getValueAsString())
                    .isEqualTo(NASCIMENTO_DE_10001);

            Bundle b = buscar(Patient.BIRTHDATE.exactly().day(NASCIMENTO_DE_10001));

            assertThat(b.getEntry()).isNotEmpty();
            assertThat(b.getEntry()).allSatisfy(e ->
                    assertThat(((Patient) e.getResource()).getBirthDateElement().getValueAsString())
                            .isEqualTo(NASCIMENTO_DE_10001));
        }

        @Test
        @DisplayName("por _lastUpdated alcanca registro que nao tinha dt_atualizacao")
        void lastUpdatedAlcancaRegistroSemCarimbo() {
            Bundle b = cliente().search().forResource(Patient.class)
                    .lastUpdated(new ca.uhn.fhir.rest.param.DateRangeParam("2014-09-01", "2014-09-30"))
                    .count(300).returnBundle(Bundle.class).execute();

            assertThat(b.getEntry()).extracting(e -> ((Patient) e.getResource()).getIdElement().getIdPart())
                    .contains(CASO_DIFICIL);
        }
    }

    @Nested
    @DisplayName("Contrato do servidor")
    class Contrato {

        @Test
        @DisplayName("o CapabilityStatement declara apenas leitura e busca")
        void apenasLeitura() {
            CapabilityStatement cs = cliente().capabilities()
                    .ofType(CapabilityStatement.class).execute();

            var patient = cs.getRestFirstRep().getResource().stream()
                    .filter(r -> "Patient".equals(r.getType()))
                    .findFirst().orElseThrow();

            assertThat(patient.getInteraction()).extracting(i -> i.getCode().toCode())
                    .allMatch(codigo -> List.of("read", "vread", "search-type").contains(codigo));
        }

        @Test
        @DisplayName("tentativa de criacao e recusada")
        void criacaoRecusada() {
            Patient novo = new Patient();
            novo.addName().setText("Nao Deve Ser Criado");

            assertThatThrownBy(() -> cliente().create().resource(novo).execute())
                    .isInstanceOf(ca.uhn.fhir.rest.server.exceptions.BaseServerResponseException.class);
        }

        @Test
        @DisplayName("a documentacao navegavel e servida")
        void documentacaoNavegavel() throws IOException, InterruptedException {
            HttpResponse<String> resposta = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + porta + "/fhir/swagger-ui/"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            assertThat(resposta.statusCode()).isEqualTo(200);
            assertThat(resposta.body()).containsIgnoringCase("swagger");
        }

        @Test
        @DisplayName("a especificacao OpenAPI e gerada a partir do CapabilityStatement")
        void openApiGerado() throws IOException, InterruptedException {
            HttpResponse<String> resposta = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + porta + "/fhir/api-docs"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            assertThat(resposta.statusCode()).isEqualTo(200);
            assertThat(resposta.body()).contains("openapi").contains("Patient");
        }
    }

    @Nested
    @DisplayName("Conformidade")
    class Conformidade {

        @Test
        @DisplayName("toda a base de homologacao valida contra o FHIR R4 sem erro")
        void baseInteiraValida() {
            Bundle b = cliente().search().forResource(Patient.class)
                    .count(300).returnBundle(Bundle.class).execute();

            assertThat(b.getEntry()).hasSize(200);

            List<String> problemas = b.getEntry().stream()
                    .map(e -> (Patient) e.getResource())
                    .flatMap(p -> validar(p).stream()
                            .map(msg -> p.getIdElement().getIdPart() + ": " + msg))
                    .toList();

            assertThat(problemas).isEmpty();
        }
    }

    /** Devolve as mensagens de severidade error ou fatal. Lista vazia significa conforme. */
    private static List<String> validar(Patient paciente) {
        ValidationResult resultado = validador.validateWithResult(paciente);
        return resultado.getMessages().stream()
                .filter(m -> m.getSeverity() == ca.uhn.fhir.validation.ResultSeverityEnum.ERROR
                        || m.getSeverity() == ca.uhn.fhir.validation.ResultSeverityEnum.FATAL)
                .map(m -> m.getLocationString() + " " + m.getMessage())
                .toList();
    }

    private static String nomePorUso(Patient p, HumanName.NameUse uso) {
        return p.getName().stream()
                .filter(n -> n.getUse() == uso)
                .map(HumanName::getText)
                .findFirst().orElse(null);
    }
}
