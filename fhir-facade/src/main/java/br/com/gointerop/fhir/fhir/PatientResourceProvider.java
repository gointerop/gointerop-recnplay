package br.com.gointerop.fhir.fhir;

import br.com.gointerop.fhir.legado.PacienteFiltro;
import br.com.gointerop.fhir.legado.PacienteLegado;
import br.com.gointerop.fhir.legado.PacienteRepository;
import ca.uhn.fhir.rest.annotation.IdParam;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Read;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.Constants;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.ParamPrefixEnum;
import ca.uhn.fhir.rest.param.DateRangeParam;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.InvalidRequestException;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import org.hl7.fhir.r4.model.IdType;
import org.hl7.fhir.r4.model.Patient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Operacoes de leitura e busca de {@code Patient}.
 *
 * <p>Nenhum metodo de escrita e declarado. Como o HAPI monta o {@code CapabilityStatement}
 * a partir das anotacoes presentes, a ausencia de {@code @Create}, {@code @Update} e
 * {@code @Delete} faz o servidor recusar essas interacoes e declarar apenas leitura —
 * a restricao fica no formato do codigo, nao em uma verificacao que alguem possa esquecer.
 */
@Component
public class PatientResourceProvider implements IResourceProvider {

    private static final Logger log = LoggerFactory.getLogger(PatientResourceProvider.class);
    private static final ZoneId FUSO = ZoneId.of("America/Recife");

    /** Comprimentos de CPF e de CNS. Ver {@link #recusarDocumentoNaUrl}. */
    private static final int DIGITOS_CPF = 11;
    private static final int DIGITOS_CNS = 15;

    private final PacienteRepository repositorio;
    private final PatientMapper mapper;

    public PatientResourceProvider(PacienteRepository repositorio, PatientMapper mapper) {
        this.repositorio = repositorio;
        this.mapper = mapper;
    }

    @Override
    public Class<Patient> getResourceType() {
        return Patient.class;
    }

    @Read
    public Patient read(@IdParam IdType id) {
        int codigo = codigoDe(id);
        return repositorio.buscar(PacienteFiltro.porCodigo(codigo)).stream()
                .findFirst()
                .map(mapper::para)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Paciente nao encontrado: " + codigo));
    }

    @Search
    public List<Patient> buscar(
            @OptionalParam(name = "_id") TokenParam porId,
            @OptionalParam(name = Patient.SP_IDENTIFIER) TokenParam identificador,
            @OptionalParam(name = Patient.SP_NAME) StringParam nome,
            @OptionalParam(name = Patient.SP_BIRTHDATE) DateRangeParam nascimento,
            @OptionalParam(name = Constants.PARAM_LASTUPDATED) DateRangeParam atualizacao) {

        PacienteFiltro filtro = PacienteFiltro.vazio();

        if (porId != null && porId.getValue() != null) {
            filtro = PacienteFiltro.porCodigo(inteiro(porId.getValue()));
        }
        if (identificador != null && identificador.getValue() != null) {
            filtro = filtro.comIdentificador(identificador.getValue());
        }
        if (nome != null && nome.getValue() != null && !nome.getValue().isBlank()) {
            filtro = filtro.comNome(nome.getValue());
        }
        if (nascimento != null && !nascimento.isEmpty()) {
            filtro = filtro.comNascimento(
                    data(nascimento.getLowerBound(), 1),
                    data(nascimento.getUpperBound(), -1));
        }
        if (atualizacao != null && !atualizacao.isEmpty()) {
            filtro = filtro.comAtualizacao(
                    instante(atualizacao.getLowerBoundAsInstant()),
                    instante(atualizacao.getUpperBoundAsInstant()));
        }

        return converter(repositorio.buscar(filtro));
    }

    /**
     * A conversao e isolada por paciente: uma linha malformada nao pode derrubar o
     * resultado inteiro. O paciente que falha e omitido e registrado apenas pelo codigo
     * do SIGH — CPF e CNS nunca entram em log (restricoes PD-04 e RNF-05).
     */
    private List<Patient> converter(List<PacienteLegado> pacientes) {
        List<Patient> recursos = new ArrayList<>(pacientes.size());
        for (PacienteLegado paciente : pacientes) {
            try {
                recursos.add(mapper.para(paciente));
            } catch (RuntimeException e) {
                log.warn("falha ao converter o paciente {}: {}", paciente.codigo(), e.getMessage());
            }
        }
        return recursos;
    }

    private int codigoDe(IdType id) {
        if (id == null || id.getIdPart() == null) {
            throw new InvalidRequestException("Identificador do paciente ausente");
        }
        return inteiro(id.getIdPart());
    }

    private int inteiro(String valor) {
        recusarDocumentoNaUrl(valor);
        try {
            return Integer.parseInt(valor);
        } catch (NumberFormatException e) {
            throw new InvalidRequestException(
                    "Identificador do paciente deve ser o codigo numerico do cadastro");
        }
    }

    /**
     * CPF nao pode aparecer em URL (restricoes PD-04 e RNF-05), e a URL e registrada em
     * log de acesso por qualquer servidor ou proxy no caminho. Como o codigo do cadastro
     * nunca tem 11 nem 15 digitos, um valor com esse comprimento so pode ser um CPF ou
     * um CNS sendo usado no lugar errado. A busca por documento existe e e por
     * {@code identifier}.
     */
    private void recusarDocumentoNaUrl(String valor) {
        if (valor != null && valor.chars().allMatch(Character::isDigit)
                && (valor.length() == DIGITOS_CPF || valor.length() == DIGITOS_CNS)) {
            throw new InvalidRequestException(
                    "CPF e CNS nao podem ser usados no caminho da URL. "
                            + "Use a busca por identifier.");
        }
    }

    /**
     * Converte um limite de faixa em data de calendario.
     *
     * <p>Deliberadamente nao usa {@code getLowerBoundAsInstant} nem
     * {@code getUpperBoundAsInstant}: o HAPI alarga esses instantes em cerca de um dia
     * para cada lado, como tolerancia de fuso horario. Isso e razoavel para carimbo de
     * tempo e errado para data de nascimento, que e data de calendario e nao tem fuso.
     * O valor textual do parametro e a fonte exata.
     *
     * <p>Os prefixos {@code gt} e {@code lt} sao exclusivos no FHIR, enquanto a consulta
     * usa comparacao inclusiva. Em precisao de dia, deslocar o limite em um dia na
     * direcao indicada por {@code ajuste} torna as duas semanticas equivalentes.
     */
    private static LocalDate data(DateParam limite, int ajuste) {
        if (limite == null || limite.getValueAsString() == null) {
            return null;
        }
        LocalDate valor = LocalDate.parse(limite.getValueAsString().substring(0, 10));
        ParamPrefixEnum prefixo = limite.getPrefix();
        boolean exclusivo = prefixo == ParamPrefixEnum.GREATERTHAN
                || prefixo == ParamPrefixEnum.LESSTHAN;
        return exclusivo ? valor.plusDays(ajuste) : valor;
    }

    private static Instant instante(Date valor) {
        return valor == null ? null : valor.toInstant();
    }
}
