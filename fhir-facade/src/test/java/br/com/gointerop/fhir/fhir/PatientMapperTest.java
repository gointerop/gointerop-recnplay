package br.com.gointerop.fhir.fhir;

import br.com.gointerop.fhir.legado.ContatoLegado;
import br.com.gointerop.fhir.legado.EnderecoLegado;
import br.com.gointerop.fhir.legado.PacienteLegado;
import br.com.gointerop.fhir.legado.PacienteLegadoBuilder;
import org.hl7.fhir.r4.model.ContactPoint;
import org.hl7.fhir.r4.model.Enumerations.AdministrativeGender;
import org.hl7.fhir.r4.model.HumanName;
import org.hl7.fhir.r4.model.Patient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Um teste por scenario da spec {@code paciente-fhir}. Quando um scenario mudar la,
 * o teste correspondente muda aqui.
 */
@DisplayName("Conversao do cadastro do SIGH para Patient")
class PatientMapperTest {

    private final PatientMapper mapper = new PatientMapper();

    private static PacienteLegadoBuilder base() {
        return new PacienteLegadoBuilder();
    }

    @Nested
    @DisplayName("Identificacao")
    class Identificacao {

        @Test
        @DisplayName("o id do recurso e o codigo do SIGH")
        void idVemDoCodigo() {
            Patient p = mapper.para(base().codigo(10001).montar());
            assertThat(p.getIdElement().getIdPart()).isEqualTo("10001");
        }

        @Test
        @DisplayName("CPF e CNS viram identifier com os systems da RNDS")
        void cpfECnsViramIdentifier() {
            Patient p = mapper.para(base().cpf("26716608044").cns("898001234567890").montar());

            assertThat(p.getIdentifier()).hasSize(2);
            assertThat(p.getIdentifier().getFirst().getSystem()).isEqualTo(Sistemas.CPF);
            assertThat(p.getIdentifier().getFirst().getValue()).isEqualTo("26716608044");
            assertThat(p.getIdentifier().get(1).getSystem()).isEqualTo(Sistemas.CNS);
        }

        @Test
        @DisplayName("paciente so com CNS traz um unico identifier")
        void apenasCns() {
            Patient p = mapper.para(base().cns("898001234567890").montar());

            assertThat(p.getIdentifier()).hasSize(1);
            assertThat(p.getIdentifier().getFirst().getSystem()).isEqualTo(Sistemas.CNS);
        }

        @Test
        @DisplayName("paciente sem CPF e sem CNS sai sem identifier, e isso nao e erro")
        void semNenhumDocumento() {
            // 3,5% da base. Nenhuma das evidencias documenta esse caso.
            Patient p = mapper.para(base().codigo(10027).montar());

            assertThat(p.hasIdentifier()).isFalse();
            assertThat(p.getIdElement().getIdPart()).isEqualTo("10027");
        }
    }

    @Nested
    @DisplayName("Nomes")
    class Nomes {

        @Test
        @DisplayName("nome social vira usual e nome civil vira official")
        void nomeSocialTemPrecedencia() {
            Patient p = mapper.para(base()
                    .nomeCivil("Rita Correia Carvalho")
                    .nomeSocial("Sérgio Correia Carvalho")
                    .montar());

            assertThat(p.getName()).hasSize(2);
            assertThat(nomePorUso(p, HumanName.NameUse.USUAL)).isEqualTo("Sérgio Correia Carvalho");
            assertThat(nomePorUso(p, HumanName.NameUse.OFFICIAL)).isEqualTo("Rita Correia Carvalho");
        }

        @Test
        @DisplayName("sem nome social sobra apenas o official")
        void semNomeSocial() {
            Patient p = mapper.para(base().nomeCivil("Pedro Carvalho Nunes").montar());

            assertThat(p.getName()).hasSize(1);
            assertThat(p.getName().getFirst().getUse()).isEqualTo(HumanName.NameUse.OFFICIAL);
        }

        private String nomePorUso(Patient p, HumanName.NameUse uso) {
            return p.getName().stream()
                    .filter(n -> n.getUse() == uso)
                    .map(HumanName::getText)
                    .findFirst().orElse(null);
        }
    }

    @Nested
    @DisplayName("Sexo")
    class Sexo {

        @ParameterizedTest(name = "tp_sexo {0} vira {1}")
        @CsvSource({"M, MALE", "F, FEMALE", "I, UNKNOWN"})
        void mapeiaDominio(String origem, AdministrativeGender esperado) {
            Patient p = mapper.para(base().sexo(origem).montar());
            assertThat(p.getGender()).isEqualTo(esperado);
        }

        @Test
        @DisplayName("I vira unknown e nunca other")
        void indeterminadoNaoEhOther() {
            // 'other' afirmaria que a pessoa nao e masculino nem feminino. A origem nao
            // sustenta essa afirmacao: o valor nao consta no dominio SEXO e veio da
            // migracao de 2013 sem significado documentado.
            Patient p = mapper.para(base().sexo("I").montar());

            assertThat(p.getGender()).isEqualTo(AdministrativeGender.UNKNOWN);
            assertThat(p.getGender()).isNotEqualTo(AdministrativeGender.OTHER);
        }

        @Test
        @DisplayName("sexo nulo omite o elemento")
        void sexoNuloOmiteElemento() {
            assertThat(mapper.para(base().sexo(null).montar()).hasGender()).isFalse();
        }

        @Test
        @DisplayName("valor desconhecido cai em unknown em vez de quebrar")
        void valorDesconhecido() {
            assertThat(mapper.para(base().sexo("X").montar()).getGender())
                    .isEqualTo(AdministrativeGender.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("Situacao cadastral e obito")
    class SituacaoEObito {

        @Test
        @DisplayName("cadastro inativo nao implica falecido")
        void inativoNaoEhFalecido() {
            // A coordenacao de TI levantou isso em ata: ja houve integracao que tratou
            // inativo como obito, e o incidente foi grave.
            Patient p = mapper.para(base().ativo(false).obito(null).montar());

            assertThat(p.getActive()).isFalse();
            assertThat(p.hasDeceased()).isFalse();
        }

        @Test
        @DisplayName("obito preenche deceasedDateTime")
        void obitoRegistrado() {
            Patient p = mapper.para(base().obito(LocalDate.of(2024, 1, 20)).montar());
            assertThat(p.hasDeceasedDateTimeType()).isTrue();
        }

        @Test
        @DisplayName("cadastro ativo")
        void ativo() {
            assertThat(mapper.para(base().ativo(true).montar()).getActive()).isTrue();
        }
    }

    @Nested
    @DisplayName("Contatos")
    class Contatos {

        @Test
        @DisplayName("telefone em texto livre sai normalizado e com o uso correto")
        void normalizaEClassifica() {
            Patient p = mapper.para(base().contatos(List.of(
                    new ContatoLegado(1, "CEL", "(81) 99999-9999"),
                    new ContatoLegado(2, "RES", "8133334444"),
                    new ContatoLegado(3, "COM", "+55 81 32221111"),
                    new ContatoLegado(4, "EML", "paciente@exemplo.com.br"))).montar());

            assertThat(p.getTelecom()).hasSize(4);
            assertThat(p.getTelecom().getFirst().getValue()).isEqualTo("81999999999");
            assertThat(p.getTelecom().getFirst().getUse()).isEqualTo(ContactPoint.ContactPointUse.MOBILE);
            assertThat(p.getTelecom().get(1).getUse()).isEqualTo(ContactPoint.ContactPointUse.HOME);
            assertThat(p.getTelecom().get(2).getUse()).isEqualTo(ContactPoint.ContactPointUse.WORK);
            assertThat(p.getTelecom().get(3).getSystem()).isEqualTo(ContactPoint.ContactPointSystem.EMAIL);
        }

        @Test
        @DisplayName("paciente sem contato sai sem telecom")
        void semContato() {
            assertThat(mapper.para(base().montar()).hasTelecom()).isFalse();
        }

        @Test
        @DisplayName("contato invalido e descartado sem derrubar os demais")
        void contatoInvalidoEhDescartado() {
            Patient p = mapper.para(base().contatos(List.of(
                    new ContatoLegado(1, "CEL", "sem numero"),
                    new ContatoLegado(2, null, "81999999999"),
                    new ContatoLegado(3, "CEL", null),
                    new ContatoLegado(4, "ZZZ", "8133334444"))).montar());

            // So sobra o de tipo desconhecido, exposto sem afirmar o uso.
            assertThat(p.getTelecom()).hasSize(1);
            assertThat(p.getTelecom().getFirst().hasUse()).isFalse();
        }
    }

    @Nested
    @DisplayName("Endereco")
    class Enderecos {

        @Test
        @DisplayName("endereco completo preenche todos os elementos")
        void enderecoCompleto() {
            Patient p = mapper.para(base().enderecos(List.of(new EnderecoLegado(
                    1, "Rua do Sol", "123", "Apto 402", "Boa Viagem",
                    "Recife", "PE", "51020000", true))).montar());

            var endereco = p.getAddressFirstRep();
            assertThat(endereco.getLine()).extracting(Object::toString)
                    .containsExactly("Rua do Sol, 123", "Apto 402");
            assertThat(endereco.getDistrict()).isEqualTo("Boa Viagem");
            assertThat(endereco.getCity()).isEqualTo("Recife");
            assertThat(endereco.getState()).isEqualTo("PE");
            assertThat(endereco.getPostalCode()).isEqualTo("51020000");
            assertThat(endereco.getCountry()).isEqualTo("BR");
        }

        @Test
        @DisplayName("elemento sem valor na origem e omitido, nao preenchido em branco")
        void omiteElementoAusente() {
            Patient p = mapper.para(base().enderecos(List.of(new EnderecoLegado(
                    1, "Travessa das Flores", null, null, null,
                    null, null, null, true))).montar());

            var endereco = p.getAddressFirstRep();
            assertThat(endereco.getLine()).extracting(Object::toString)
                    .containsExactly("Travessa das Flores");
            assertThat(endereco.hasPostalCode()).isFalse();
            assertThat(endereco.hasCity()).isFalse();
            assertThat(endereco.hasDistrict()).isFalse();
        }

        @Test
        @DisplayName("paciente sem endereco sai sem o elemento")
        void semEndereco() {
            assertThat(mapper.para(base().montar()).hasAddress()).isFalse();
        }

        @Test
        @DisplayName("com varios enderecos, o principal de menor codigo vence")
        void escolhaDeterministica() {
            Patient p = mapper.para(base().enderecos(List.of(
                    new EnderecoLegado(1, "Rua A", null, null, null, null, null, null, false),
                    new EnderecoLegado(2, "Rua B", null, null, null, null, null, null, true),
                    new EnderecoLegado(3, "Rua C", null, null, null, null, null, null, true))).montar());

            assertThat(p.getAddressFirstRep().getLine().getFirst().toString()).isEqualTo("Rua B");
        }

        @Test
        @DisplayName("sem nenhum principal, vale o de menor codigo")
        void semPrincipal() {
            Patient p = mapper.para(base().enderecos(List.of(
                    new EnderecoLegado(7, "Rua G", null, null, null, null, null, null, false),
                    new EnderecoLegado(9, "Rua H", null, null, null, null, null, null, false))).montar());

            assertThat(p.getAddressFirstRep().getLine().getFirst().toString()).isEqualTo("Rua G");
        }
    }

    @Nested
    @DisplayName("Metadados e minimizacao")
    class MetadadosEMinimizacao {

        @Test
        @DisplayName("lastUpdated vem da data efetiva de atualizacao")
        void lastUpdated() {
            Instant instante = Instant.parse("2026-03-10T12:00:00Z");
            Patient p = mapper.para(base().atualizadoEm(instante).montar());

            assertThat(p.getMeta().getLastUpdated().toInstant()).isEqualTo(instante);
        }

        @Test
        @DisplayName("sem data efetiva, o recurso sai sem lastUpdated")
        void semLastUpdated() {
            assertThat(mapper.para(base().atualizadoEm(null).montar()).getMeta().hasLastUpdated())
                    .isFalse();
        }

        @Test
        @DisplayName("nascimento ausente omite o elemento")
        void semNascimento() {
            assertThat(mapper.para(base().nascimento(null).montar()).hasBirthDate()).isFalse();
        }

        @Test
        @DisplayName("nascimento presente e mapeado")
        void comNascimento() {
            assertThat(mapper.para(base().nascimento(LocalDate.of(1978, 3, 14)).montar())
                    .hasBirthDate()).isTrue();
        }

        @Test
        @DisplayName("data antiga nao anda um dia por causa do fuso da JVM")
        void nascimentoNaoSofreDeslocamentoDeFuso() {
            // Regressao. A primeira versao convertia a data para java.util.Date a
            // meia-noite de America/Recife, e o HAPI a serializava de volta usando o
            // fuso padrao da JVM. Numa maquina em America/Cayenne — UTC-4 ate 1967 — a
            // data de 1940-08-04 saia como 1940-08-03. Data de nascimento errada por um
            // dia quebra pareamento de paciente.
            assertThat(mapper.para(base().nascimento(LocalDate.of(1940, 8, 4)).montar())
                    .getBirthDateElement().getValueAsString()).isEqualTo("1940-08-04");
        }

        @Test
        @DisplayName("data de obito tambem nao sofre deslocamento de fuso")
        void obitoNaoSofreDeslocamentoDeFuso() {
            assertThat(mapper.para(base().obito(LocalDate.of(1950, 1, 1)).montar())
                    .getDeceasedDateTimeType().getValueAsString()).isEqualTo("1950-01-01");
        }

        @Test
        @DisplayName("o nome da mae nao existe no recurso porque nao existe no modelo")
        void nomeDaMaeNaoTrafega() {
            // A restricao PD-03 nao e verificada aqui por acaso: PacienteLegado nao tem
            // o campo, e PacienteRepository nao le a coluna. O dado nao chega ao mapper.
            assertThat(PacienteLegado.class.getRecordComponents())
                    .extracting(java.lang.reflect.RecordComponent::getName)
                    .doesNotContain("nomeMae", "nmMae");
        }
    }
}
