package br.com.gointerop.fhir.fhir;

/** Systems de identificacao adotados. */
public final class Sistemas {

    /** CPF, conforme o NamingSystem publicado pela RNDS. */
    public static final String CPF = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf";

    /** Cartao Nacional de Saude, conforme o NamingSystem publicado pela RNDS. */
    public static final String CNS = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns";

    private Sistemas() {
    }
}
