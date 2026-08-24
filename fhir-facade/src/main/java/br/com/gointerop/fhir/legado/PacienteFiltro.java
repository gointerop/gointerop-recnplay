package br.com.gointerop.fhir.legado;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Criterios de busca aceitos pela fachada. Todo campo e opcional; os informados
 * sao combinados com E.
 *
 * <p>As faixas de data seguem a semantica do FHIR: limites inclusivos, e nulo
 * significa sem limite daquele lado.
 */
public record PacienteFiltro(
        Integer codigo,
        String identificador,
        String nome,
        LocalDate nascimentoDe,
        LocalDate nascimentoAte,
        Instant atualizadoDe,
        Instant atualizadoAte) {

    public static PacienteFiltro porCodigo(int codigo) {
        return new PacienteFiltro(codigo, null, null, null, null, null, null);
    }

    public static PacienteFiltro vazio() {
        return new PacienteFiltro(null, null, null, null, null, null, null);
    }

    public PacienteFiltro comIdentificador(String valor) {
        return new PacienteFiltro(codigo, valor, nome, nascimentoDe, nascimentoAte, atualizadoDe, atualizadoAte);
    }

    public PacienteFiltro comNome(String valor) {
        return new PacienteFiltro(codigo, identificador, valor, nascimentoDe, nascimentoAte, atualizadoDe, atualizadoAte);
    }

    public PacienteFiltro comNascimento(LocalDate de, LocalDate ate) {
        return new PacienteFiltro(codigo, identificador, nome, de, ate, atualizadoDe, atualizadoAte);
    }

    public PacienteFiltro comAtualizacao(Instant de, Instant ate) {
        return new PacienteFiltro(codigo, identificador, nome, nascimentoDe, nascimentoAte, de, ate);
    }
}
