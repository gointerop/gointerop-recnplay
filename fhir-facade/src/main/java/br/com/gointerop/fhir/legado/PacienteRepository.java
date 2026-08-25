package br.com.gointerop.fhir.legado;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Leitura do cadastro de pacientes do SIGH.
 *
 * <p>Somente leitura, com privilegio de {@code SELECT} sobre o schema {@code sigh}.
 * Nenhuma instrucao de escrita e emitida por esta classe, e nenhum objeto do banco
 * do fornecedor e criado ou alterado (restricoes RA-01 e RA-02).
 *
 * <p>Uma unica consulta com juncoes traz paciente, contatos e endereco. A alternativa
 * — uma consulta por bloco, por paciente — produziria N+1 sobre uma base de producao
 * com 480 mil registros.
 *
 * <p>Como as constraints de integridade referencial foram removidas da origem em 2021,
 * toda juncao e defensiva: ausencia de linha filha e caso normal, nunca erro.
 */
@Repository
public class PacienteRepository {

    /**
     * Dobra acentuacao para a busca por nome. A extensao {@code unaccent} exigiria
     * alterar o banco do fornecedor, o que a restricao RA-02 proibe, entao a dobra e
     * feita com {@code translate} — disponivel desde muito antes da versao 12, que e a
     * de producao.
     */
    private static final String SEM_ACENTO =
            "translate(lower(%s), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')";

    /**
     * Colunas lidas do cadastro. {@code nm_mae} esta deliberadamente ausente: o dado
     * nao pode trafegar (restricao PD-03), e a forma mais segura de garantir isso e
     * nunca busca-lo.
     *
     * <p>A data efetiva de atualizacao usa {@code COALESCE} porque {@code dt_atualizacao}
     * e nula em 7% dos registros. Sem o recurso, esses pacientes seriam invisiveis a
     * qualquer consumidor que sincronize incrementalmente.
     */
    private static final String SELECT = """
            SELECT p.cd_paciente, p.nm_paciente, p.nm_social, p.dt_nascimento, p.tp_sexo,
                   p.nr_cpf, p.nr_cns, p.st_ativo, p.dt_obito,
                   COALESCE(p.dt_atualizacao, p.dt_cadastro) AS dt_efetiva,
                   c.cd_contato, c.tp_contato, c.ds_contato,
                   e.cd_endereco, e.ds_logradouro, e.nr_numero, e.ds_complemento,
                   e.nm_bairro, e.sg_uf, e.nr_cep, e.st_principal AS end_principal,
                   m.nm_municipio
              FROM sigh.paciente p
              LEFT JOIN sigh.paciente_contato  c ON c.cd_paciente = p.cd_paciente
              LEFT JOIN sigh.paciente_endereco e ON e.cd_paciente = p.cd_paciente
              LEFT JOIN sigh.municipio_ibge    m ON m.cd_municipio_ibge = e.cd_municipio_ibge
            """;

    private final JdbcTemplate jdbc;

    public PacienteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PacienteLegado> buscar(PacienteFiltro filtro) {
        List<String> condicoes = new ArrayList<>();
        List<Object> parametros = new ArrayList<>();

        if (filtro.codigo() != null) {
            condicoes.add("p.cd_paciente = ?");
            parametros.add(filtro.codigo());
        }
        if (filtro.identificador() != null) {
            String digitos = somenteDigitos(filtro.identificador());
            condicoes.add("(p.nr_cpf = ? OR p.nr_cns = ?)");
            parametros.add(digitos);
            parametros.add(digitos);
        }
        if (filtro.nome() != null) {
            // Busca no nome civil e tambem no nome social: quem procura por um nome
            // social precisa encontrar a pessoa.
            String termo = "%" + semAcento(filtro.nome()) + "%";
            condicoes.add("(" + SEM_ACENTO.formatted("p.nm_paciente") + " LIKE ?"
                    + " OR " + SEM_ACENTO.formatted("COALESCE(p.nm_social, '')") + " LIKE ?)");
            parametros.add(termo);
            parametros.add(termo);
        }
        if (filtro.nascimentoDe() != null) {
            condicoes.add("p.dt_nascimento >= ?");
            parametros.add(java.sql.Date.valueOf(filtro.nascimentoDe()));
        }
        if (filtro.nascimentoAte() != null) {
            condicoes.add("p.dt_nascimento <= ?");
            parametros.add(java.sql.Date.valueOf(filtro.nascimentoAte()));
        }
        if (filtro.atualizadoDe() != null) {
            condicoes.add("COALESCE(p.dt_atualizacao, p.dt_cadastro) >= ?");
            parametros.add(Timestamp.from(filtro.atualizadoDe()));
        }
        if (filtro.atualizadoAte() != null) {
            condicoes.add("COALESCE(p.dt_atualizacao, p.dt_cadastro) <= ?");
            parametros.add(Timestamp.from(filtro.atualizadoAte()));
        }

        String sql = SELECT
                + (condicoes.isEmpty() ? "" : " WHERE " + String.join(" AND ", condicoes))
                + " ORDER BY p.cd_paciente, c.cd_contato, e.cd_endereco";

        return agrupar(sql, parametros.toArray());
    }

    /**
     * As juncoes produzem o produto entre contatos e enderecos, entao o mesmo contato
     * aparece repetido uma vez por endereco. O agrupamento usa o codigo de cada filho
     * como chave para nao duplicar.
     */
    private List<PacienteLegado> agrupar(String sql, Object[] parametros) {
        Map<Integer, Acumulador> porPaciente = new LinkedHashMap<>();

        jdbc.query(sql, rs -> {
            int codigo = rs.getInt("cd_paciente");
            Acumulador acc = porPaciente.computeIfAbsent(codigo, k -> new Acumulador(cabecalho(rs)));

            int codContato = rs.getInt("cd_contato");
            if (!rs.wasNull() && !acc.contatos.containsKey(codContato)) {
                acc.contatos.put(codContato, new ContatoLegado(
                        codContato, texto(rs, "tp_contato"), texto(rs, "ds_contato")));
            }

            int codEndereco = rs.getInt("cd_endereco");
            if (!rs.wasNull() && !acc.enderecos.containsKey(codEndereco)) {
                acc.enderecos.put(codEndereco, new EnderecoLegado(
                        codEndereco,
                        texto(rs, "ds_logradouro"), texto(rs, "nr_numero"), texto(rs, "ds_complemento"),
                        texto(rs, "nm_bairro"), texto(rs, "nm_municipio"), texto(rs, "sg_uf"),
                        texto(rs, "nr_cep"), "S".equals(texto(rs, "end_principal"))));
            }
        }, parametros);

        return porPaciente.values().stream().map(Acumulador::montar).toList();
    }

    private static Cabecalho cabecalho(ResultSet rs) {
        try {
            Timestamp efetiva = rs.getTimestamp("dt_efetiva");
            return new Cabecalho(
                    rs.getInt("cd_paciente"),
                    texto(rs, "nm_paciente"),
                    texto(rs, "nm_social"),
                    data(rs, "dt_nascimento"),
                    texto(rs, "tp_sexo"),
                    texto(rs, "nr_cpf"),
                    texto(rs, "nr_cns"),
                    !"N".equals(texto(rs, "st_ativo")),
                    data(rs, "dt_obito"),
                    efetiva == null ? null : efetiva.toInstant());
        } catch (SQLException e) {
            throw new IllegalStateException("falha ao ler o cadastro do paciente", e);
        }
    }

    private static String texto(ResultSet rs, String coluna) {
        try {
            String v = rs.getString(coluna);
            return v == null || v.isBlank() ? null : v.trim();
        } catch (SQLException e) {
            throw new IllegalStateException("falha ao ler a coluna " + coluna, e);
        }
    }

    private static LocalDate data(ResultSet rs, String coluna) {
        try {
            java.sql.Date d = rs.getDate(coluna);
            return d == null ? null : d.toLocalDate();
        } catch (SQLException e) {
            throw new IllegalStateException("falha ao ler a coluna " + coluna, e);
        }
    }

    static String somenteDigitos(String valor) {
        return valor == null ? null : valor.replaceAll("\\D", "");
    }

    static String semAcento(String valor) {
        return java.text.Normalizer.normalize(valor, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase();
    }

    private record Cabecalho(int codigo, String nomeCivil, String nomeSocial, LocalDate nascimento,
                             String sexo, String cpf, String cns, boolean ativo, LocalDate obito,
                             Instant atualizadoEm) {
    }

    private static final class Acumulador {
        private final Cabecalho cabecalho;
        private final Map<Integer, ContatoLegado> contatos = new LinkedHashMap<>();
        private final Map<Integer, EnderecoLegado> enderecos = new LinkedHashMap<>();

        private Acumulador(Cabecalho cabecalho) {
            this.cabecalho = cabecalho;
        }

        private PacienteLegado montar() {
            return new PacienteLegado(
                    cabecalho.codigo(), cabecalho.nomeCivil(), cabecalho.nomeSocial(),
                    cabecalho.nascimento(), cabecalho.sexo(), cabecalho.cpf(), cabecalho.cns(),
                    cabecalho.ativo(), cabecalho.obito(), cabecalho.atualizadoEm(),
                    List.copyOf(contatos.values()), List.copyOf(enderecos.values()));
        }
    }
}
