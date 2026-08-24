package br.com.gointerop.fhir.legado;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Construtor de {@link PacienteLegado} para os testes.
 *
 * <p>Fica no codigo de teste de proposito: producao nao precisa de construtor fluente,
 * e mante-lo aqui evita que a facilidade de teste vire API publica.
 *
 * <p>Os valores iniciais representam o paciente mais simples possivel — sem documento,
 * sem contato, sem endereco — para que cada teste declare apenas o que lhe interessa.
 */
public class PacienteLegadoBuilder {

    private int codigo = 10001;
    private String nomeCivil = "Paciente de Teste";
    private String nomeSocial;
    private LocalDate nascimento = LocalDate.of(1980, 1, 1);
    private String sexo = "F";
    private String cpf;
    private String cns;
    private boolean ativo = true;
    private LocalDate obito;
    private Instant atualizadoEm = Instant.parse("2026-01-15T10:00:00Z");
    private List<ContatoLegado> contatos = List.of();
    private List<EnderecoLegado> enderecos = List.of();

    public PacienteLegadoBuilder codigo(int valor) {
        this.codigo = valor;
        return this;
    }

    public PacienteLegadoBuilder nomeCivil(String valor) {
        this.nomeCivil = valor;
        return this;
    }

    public PacienteLegadoBuilder nomeSocial(String valor) {
        this.nomeSocial = valor;
        return this;
    }

    public PacienteLegadoBuilder nascimento(LocalDate valor) {
        this.nascimento = valor;
        return this;
    }

    public PacienteLegadoBuilder sexo(String valor) {
        this.sexo = valor;
        return this;
    }

    public PacienteLegadoBuilder cpf(String valor) {
        this.cpf = valor;
        return this;
    }

    public PacienteLegadoBuilder cns(String valor) {
        this.cns = valor;
        return this;
    }

    public PacienteLegadoBuilder ativo(boolean valor) {
        this.ativo = valor;
        return this;
    }

    public PacienteLegadoBuilder obito(LocalDate valor) {
        this.obito = valor;
        return this;
    }

    public PacienteLegadoBuilder atualizadoEm(Instant valor) {
        this.atualizadoEm = valor;
        return this;
    }

    public PacienteLegadoBuilder contatos(List<ContatoLegado> valor) {
        this.contatos = valor;
        return this;
    }

    public PacienteLegadoBuilder enderecos(List<EnderecoLegado> valor) {
        this.enderecos = valor;
        return this;
    }

    public PacienteLegado montar() {
        return new PacienteLegado(codigo, nomeCivil, nomeSocial, nascimento, sexo, cpf, cns,
                ativo, obito, atualizadoEm, contatos, enderecos);
    }
}
