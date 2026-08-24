package br.com.gointerop.fhir.fhir;

import br.com.gointerop.fhir.legado.PacienteFiltro;
import br.com.gointerop.fhir.legado.PacienteLegado;
import br.com.gointerop.fhir.legado.PacienteLegadoBuilder;
import br.com.gointerop.fhir.legado.PacienteRepository;
import ca.uhn.fhir.rest.param.DateRangeParam;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.exceptions.InvalidRequestException;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Patient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("Operacoes de leitura e busca de Patient")
class PatientResourceProviderTest {

    private PacienteRepository repositorio;
    private PatientResourceProvider provider;

    @BeforeEach
    void preparar() {
        repositorio = mock(PacienteRepository.class);
        provider = new PatientResourceProvider(repositorio, new PatientMapper());
    }

    private void repositorioRetorna(PacienteLegado... pacientes) {
        when(repositorio.buscar(any())).thenReturn(List.of(pacientes));
    }

    private PacienteFiltro filtroUsado() {
        ArgumentCaptor<PacienteFiltro> captor = ArgumentCaptor.forClass(PacienteFiltro.class);
        org.mockito.Mockito.verify(repositorio).buscar(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("o tipo servido e Patient")
    void tipoServido() {
        assertThat(provider.getResourceType()).isEqualTo(Patient.class);
    }

    @Test
    @DisplayName("leitura por codigo devolve o paciente")
    void leituraPorCodigo() {
        repositorioRetorna(new PacienteLegadoBuilder().codigo(10001).montar());

        Patient p = provider.read(new IdType("Patient", "10001"));

        assertThat(p.getIdElement().getIdPart()).isEqualTo("10001");
        assertThat(filtroUsado().codigo()).isEqualTo(10001);
    }

    @Test
    @DisplayName("codigo inexistente resulta em 404")
    void codigoInexistente() {
        repositorioRetorna();

        assertThatThrownBy(() -> provider.read(new IdType("Patient", "99999")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @ParameterizedTest(name = "id \"{0}\" e recusado")
    @DisplayName("CPF e CNS nao podem ser usados no caminho da URL")
    @ValueSource(strings = {"26716608044", "898001234567890"})
    void documentoNaUrlEhRecusado(String documento) {
        // A URL vai para log de acesso de qualquer proxy no caminho. Restricoes PD-04
        // e RNF-05. O codigo do cadastro nunca tem 11 nem 15 digitos.
        assertThatThrownBy(() -> provider.read(new IdType("Patient", documento)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("identifier");
    }

    @Test
    @DisplayName("id nao numerico e recusado")
    void idNaoNumerico() {
        assertThatThrownBy(() -> provider.read(new IdType("Patient", "abc")))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("codigo numerico");
    }

    @Test
    @DisplayName("id ausente e recusado")
    void idAusente() {
        assertThatThrownBy(() -> provider.read(null))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    @DisplayName("busca sem filtro devolve tudo que a origem trouxer")
    void buscaSemFiltro() {
        repositorioRetorna(
                new PacienteLegadoBuilder().codigo(1).montar(),
                new PacienteLegadoBuilder().codigo(2).montar());

        assertThat(provider.buscar(null, null, null, null, null)).hasSize(2);
    }

    @Test
    @DisplayName("busca por _id")
    void buscaPorId() {
        repositorioRetorna(new PacienteLegadoBuilder().codigo(10005).montar());

        provider.buscar(new TokenParam("10005"), null, null, null, null);

        assertThat(filtroUsado().codigo()).isEqualTo(10005);
    }

    @Test
    @DisplayName("busca por identifier repassa o valor")
    void buscaPorIdentifier() {
        repositorioRetorna();

        provider.buscar(null, new TokenParam(Sistemas.CPF, "26716608044"), null, null, null);

        assertThat(filtroUsado().identificador()).isEqualTo("26716608044");
    }

    @Test
    @DisplayName("busca por nome repassa o termo")
    void buscaPorNome() {
        repositorioRetorna();

        provider.buscar(null, null, new StringParam("antonio"), null, null);

        assertThat(filtroUsado().nome()).isEqualTo("antonio");
    }

    @Test
    @DisplayName("nome em branco nao vira filtro")
    void nomeEmBrancoEhIgnorado() {
        repositorioRetorna();

        provider.buscar(null, null, new StringParam("   "), null, null);

        assertThat(filtroUsado().nome()).isNull();
    }

    @Test
    @DisplayName("busca por data de nascimento vira faixa")
    void buscaPorNascimento() {
        repositorioRetorna();

        provider.buscar(null, null, null, new DateRangeParam("1978-03-14", "1978-03-14"), null);

        PacienteFiltro filtro = filtroUsado();
        assertThat(filtro.nascimentoDe()).isEqualTo(LocalDate.of(1978, 3, 14));
        assertThat(filtro.nascimentoAte()).isEqualTo(LocalDate.of(1978, 3, 14));
    }

    @Test
    @DisplayName("busca por _lastUpdated vira faixa de instantes")
    void buscaPorAtualizacao() {
        repositorioRetorna();

        provider.buscar(null, null, null, null, new DateRangeParam("2026-01-01", "2026-12-31"));

        PacienteFiltro filtro = filtroUsado();
        assertThat(filtro.atualizadoDe()).isNotNull();
        assertThat(filtro.atualizadoAte()).isNotNull();
    }

    @Test
    @DisplayName("faixa de data vazia nao vira filtro")
    void faixaVaziaEhIgnorada() {
        repositorioRetorna();

        provider.buscar(null, null, null, new DateRangeParam(), new DateRangeParam());

        PacienteFiltro filtro = filtroUsado();
        assertThat(filtro.nascimentoDe()).isNull();
        assertThat(filtro.atualizadoDe()).isNull();
    }

    @Test
    @DisplayName("paciente que falha na conversao e omitido sem derrubar os demais")
    void falhaIsoladaNaoDerrubaResultado() {
        // A conversao e isolada por paciente: uma linha malformada nao pode custar o
        // resultado inteiro.
        PacienteLegado defeituoso = new PacienteLegado(
                7, "Quebrado", null, null, "F", null, null, true, null, null,
                null, List.of()); // contatos nulo faz o mapper lancar

        repositorioRetorna(
                new PacienteLegadoBuilder().codigo(1).montar(),
                defeituoso,
                new PacienteLegadoBuilder().codigo(3).montar());

        List<Patient> resultado = provider.buscar(null, null, null, null, null);

        assertThat(resultado).hasSize(2);
        assertThat(resultado).extracting(p -> p.getIdElement().getIdPart())
                .containsExactly("1", "3");
    }

    @Test
    @DisplayName("nenhuma operacao de escrita e declarada")
    void semOperacoesDeEscrita() {
        // O HAPI monta o CapabilityStatement a partir das anotacoes presentes. A
        // ausencia dessas anotacoes e o que faz o servidor recusar escrita.
        assertThat(PatientResourceProvider.class.getDeclaredMethods())
                .noneMatch(m -> m.isAnnotationPresent(ca.uhn.fhir.rest.annotation.Create.class)
                        || m.isAnnotationPresent(ca.uhn.fhir.rest.annotation.Update.class)
                        || m.isAnnotationPresent(ca.uhn.fhir.rest.annotation.Delete.class)
                        || m.isAnnotationPresent(ca.uhn.fhir.rest.annotation.Patch.class));
    }
}
