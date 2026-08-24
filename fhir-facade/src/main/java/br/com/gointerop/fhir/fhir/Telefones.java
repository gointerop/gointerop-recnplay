package br.com.gointerop.fhir.fhir;

/**
 * Normalizacao de telefone.
 *
 * <p>A origem grava telefone como texto livre, sem mascara nem validacao — a recepcao
 * digita como quiser. O dicionario de dados do fornecedor registra o fato na Nota 3, e
 * a base de homologacao traz ao menos seis formatos distintos para o mesmo tipo de
 * numero.
 *
 * <p>A normalizacao acontece aqui, e nao no SQL, porque expressoes regulares no
 * PostgreSQL variam entre versoes e a producao roda 12.14.
 */
public final class Telefones {

    private Telefones() {
    }

    /**
     * Reduz o valor a apenas digitos e remove o codigo do pais quando presente.
     *
     * <p>O prefixo {@code 55} so e descartado quando o resultado tem 12 ou 13 digitos,
     * que sao os comprimentos de um numero brasileiro com DDD e codigo do pais. Um
     * numero de 10 ou 11 digitos ja esta no formato local e e preservado inteiro —
     * inclusive quando comeca com 55, que e o DDD de Caxias do Sul.
     */
    public static String normalizar(String bruto) {
        if (bruto == null) {
            return null;
        }
        String digitos = bruto.replaceAll("\\D", "");
        if (digitos.isEmpty()) {
            return null;
        }
        if (digitos.startsWith("55") && (digitos.length() == 12 || digitos.length() == 13)) {
            return digitos.substring(2);
        }
        return digitos;
    }
}
