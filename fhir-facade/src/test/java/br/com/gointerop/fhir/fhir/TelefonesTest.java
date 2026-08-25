package br.com.gointerop.fhir.fhir;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Normalizacao de telefone")
class TelefonesTest {

    @ParameterizedTest(name = "{0} vira {1}")
    @DisplayName("os seis formatos que a origem realmente grava convergem para o mesmo numero")
    @CsvSource({
            "'(81) 99999-9999', 81999999999",
            "'81999999999',     81999999999",
            "'(81)999999999',   81999999999",
            "'81 99999-9999',   81999999999",
            "'+55 81 999999999', 81999999999",
            "'81-9999-9999',    8199999999",
    })
    void normalizaFormatosLivres(String bruto, String esperado) {
        assertThat(Telefones.normalizar(bruto)).isEqualTo(esperado);
    }

    @Test
    @DisplayName("o codigo do pais e removido quando o numero tem 12 ou 13 digitos")
    void removeCodigoDoPais() {
        assertThat(Telefones.normalizar("5581999999999")).isEqualTo("81999999999");
        assertThat(Telefones.normalizar("558133334444")).isEqualTo("8133334444");
    }

    @Test
    @DisplayName("o DDD 55 de Caxias do Sul e preservado")
    void preservaDddCinquentaECinco() {
        // Um numero local de 11 digitos comecando com 55 e DDD, nao codigo do pais.
        assertThat(Telefones.normalizar("55999887766")).isEqualTo("55999887766");
        assertThat(Telefones.normalizar("5533334444")).isEqualTo("5533334444");
    }

    @ParameterizedTest
    @DisplayName("valor sem nenhum digito nao vira telefone")
    @ValueSource(strings = {"", "   ", "sem telefone", "()-"})
    void semDigitosResultaNulo(String bruto) {
        assertThat(Telefones.normalizar(bruto)).isNull();
    }

    @Test
    @DisplayName("nulo continua nulo")
    void nuloSegueNulo() {
        assertThat(Telefones.normalizar(null)).isNull();
    }
}
