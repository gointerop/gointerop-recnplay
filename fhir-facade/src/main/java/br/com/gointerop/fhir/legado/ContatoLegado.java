package br.com.gointerop.fhir.legado;

/** Um contato do paciente. O valor vem como texto livre, sem normalizacao na origem. */
public record ContatoLegado(int codigo, String tipo, String valor) {
}
