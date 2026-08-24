package br.com.gointerop.fhir.legado;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Um paciente como ele existe no SIGH, ja agrupado a partir das linhas da consulta.
 *
 * <p>Note o que <b>nao</b> esta aqui: o nome da mae. A coluna {@code nm_mae} nao e
 * lida em nenhum ponto da fachada, por determinacao do encarregado de dados do
 * hospital (restricao PD-03). A minimizacao e aplicada na consulta, nao na conversao,
 * para que o dado nunca chegue a trafegar dentro do processo.
 */
public record PacienteLegado(
        int codigo,
        String nomeCivil,
        String nomeSocial,
        LocalDate nascimento,
        String sexo,
        String cpf,
        String cns,
        boolean ativo,
        LocalDate obito,
        Instant atualizadoEm,
        List<ContatoLegado> contatos,
        List<EnderecoLegado> enderecos) {

    /**
     * Endereco a ser exposto. A origem nao garante exatamente um endereco marcado
     * como principal — pode nao haver nenhum, e pode haver varios. A escolha e
     * deterministica: o principal de menor codigo; na ausencia de principal, o de
     * menor codigo entre todos.
     */
    public EnderecoLegado enderecoPrincipal() {
        return enderecos.stream()
                .filter(EnderecoLegado::principal)
                .findFirst()
                .orElseGet(() -> enderecos.isEmpty() ? null : enderecos.getFirst());
    }
}
