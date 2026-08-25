package br.com.gointerop.fhir.legado;

/** Um endereco do paciente, ja com o nome do municipio resolvido pela tabela do IBGE. */
public record EnderecoLegado(
        int codigo,
        String logradouro,
        String numero,
        String complemento,
        String bairro,
        String municipio,
        String uf,
        String cep,
        boolean principal) {
}
