package br.com.gointerop.fhir.fhir;

import br.com.gointerop.fhir.legado.ContatoLegado;
import br.com.gointerop.fhir.legado.EnderecoLegado;
import br.com.gointerop.fhir.legado.PacienteLegado;
import org.hl7.fhir.r4.model.Address;
import org.hl7.fhir.r4.model.ContactPoint;
import org.hl7.fhir.r4.model.DateTimeType;
import org.hl7.fhir.r4.model.DateType;
import org.hl7.fhir.r4.model.Enumerations.AdministrativeGender;
import org.hl7.fhir.r4.model.HumanName;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.stereotype.Component;

import java.util.Date;

/**
 * Converte o cadastro do SIGH em um recurso {@code Patient} do FHIR R4.
 *
 * <p>Cada decisao de mapeamento aqui esta registrada na spec
 * {@code openspec/specs/paciente-fhir/spec.md}, com a evidencia que a originou.
 * Quando este codigo e a spec discordarem, a spec esta certa.
 */
@Component
public class PatientMapper {

    public Patient para(PacienteLegado origem) {
        Patient patient = new Patient();

        // O identificador logico e o codigo do SIGH, nao o CPF: e a unica coluna
        // presente em 100% dos registros.
        patient.setId(String.valueOf(origem.codigo()));

        if (origem.atualizadoEm() != null) {
            patient.getMeta().setLastUpdated(Date.from(origem.atualizadoEm()));
        }

        aplicarIdentificadores(patient, origem);
        aplicarNomes(patient, origem);
        aplicarSexo(patient, origem);
        aplicarNascimento(patient, origem);
        aplicarSituacao(patient, origem);
        aplicarContatos(patient, origem);
        aplicarEndereco(patient, origem);

        return patient;
    }

    /**
     * CPF e CNS sao identificadores de negocio e ambos sao opcionais. Um paciente sem
     * nenhum dos dois e caso normal — sao 3,5% da base — e o recurso simplesmente sai
     * sem o elemento.
     */
    private void aplicarIdentificadores(Patient patient, PacienteLegado origem) {
        if (origem.cpf() != null) {
            patient.addIdentifier().setSystem(Sistemas.CPF).setValue(origem.cpf());
        }
        if (origem.cns() != null) {
            patient.addIdentifier().setSystem(Sistemas.CNS).setValue(origem.cns());
        }
    }

    /**
     * O nome social, quando existe, tem precedencia de exibicao — obrigacao do Decreto
     * 8.727/2016, nao preferencia de produto. O nome civil permanece disponivel como
     * {@code official} para emissao de documento.
     *
     * <p>Apenas {@code text} e preenchido. A origem guarda o nome em um unico campo, e
     * dividir em {@code family} e {@code given} seria adivinhacao: "Maria dos Santos
     * Silva" nao tem separacao deduzivel com seguranca.
     */
    private void aplicarNomes(Patient patient, PacienteLegado origem) {
        if (origem.nomeSocial() != null) {
            patient.addName().setUse(HumanName.NameUse.USUAL).setText(origem.nomeSocial());
        }
        if (origem.nomeCivil() != null) {
            patient.addName().setUse(HumanName.NameUse.OFFICIAL).setText(origem.nomeCivil());
        }
    }

    /**
     * {@code I} vira {@code unknown} e nao {@code other}. O codigo {@code other} afirma
     * que a pessoa nao e masculino nem feminino, e a origem nao sustenta essa afirmacao:
     * o valor nao consta no dominio SEXO, nao e documentado, e veio da migracao de 2013
     * sem que ninguem no fornecedor saiba o que significa.
     */
    private void aplicarSexo(Patient patient, PacienteLegado origem) {
        if (origem.sexo() == null) {
            return;
        }
        switch (origem.sexo().toUpperCase()) {
            case "M" -> patient.setGender(AdministrativeGender.MALE);
            case "F" -> patient.setGender(AdministrativeGender.FEMALE);
            default -> patient.setGender(AdministrativeGender.UNKNOWN);
        }
    }

    /**
     * Data de nascimento e data de calendario: nao tem hora e nao tem fuso.
     *
     * <p>Convertê-la para {@code java.util.Date} — ainda que a meia-noite de um fuso
     * escolhido — a transforma em instante, e o instante volta a virar data usando o
     * fuso padrao da JVM. Quando os dois fusos divergem, a data anda um dia. E divergem
     * mais do que parece: uma data de 1940 sofre o offset historico daquele ano, nao o
     * de hoje.
     *
     * <p>Passar o texto ISO direto para o {@link DateType} preserva a precisao de dia e
     * nao envolve fuso em momento nenhum.
     */
    private void aplicarNascimento(Patient patient, PacienteLegado origem) {
        if (origem.nascimento() != null) {
            patient.setBirthDateElement(new DateType(origem.nascimento().toString()));
        }
    }

    /**
     * Situacao cadastral e obito sao independentes. Um cadastro inativo indica
     * desativacao administrativa — duplicidade, cadastro incorreto, pedido do titular —
     * e pode corresponder a pessoa viva. Colapsar os dois ja causou incidente no
     * hospital antes.
     */
    private void aplicarSituacao(Patient patient, PacienteLegado origem) {
        patient.setActive(origem.ativo());
        if (origem.obito() != null) {
            // Mesma razao da data de nascimento: a origem guarda uma data, sem hora.
            // Inventar meia-noite de um fuso qualquer seria afirmar mais do que se sabe.
            patient.setDeceased(new DateTimeType(origem.obito().toString()));
        }
    }

    private void aplicarContatos(Patient patient, PacienteLegado origem) {
        for (ContatoLegado contato : origem.contatos()) {
            if (contato.valor() == null || contato.tipo() == null) {
                continue;
            }
            if ("EML".equals(contato.tipo())) {
                patient.addTelecom()
                        .setSystem(ContactPoint.ContactPointSystem.EMAIL)
                        .setValue(contato.valor());
                continue;
            }
            String numero = Telefones.normalizar(contato.valor());
            if (numero == null) {
                continue;
            }
            ContactPoint ponto = patient.addTelecom()
                    .setSystem(ContactPoint.ContactPointSystem.PHONE)
                    .setValue(numero);
            switch (contato.tipo()) {
                case "CEL" -> ponto.setUse(ContactPoint.ContactPointUse.MOBILE);
                case "RES" -> ponto.setUse(ContactPoint.ContactPointUse.HOME);
                case "COM" -> ponto.setUse(ContactPoint.ContactPointUse.WORK);
                default -> { /* tipo desconhecido: expoe o numero sem afirmar o uso */ }
            }
        }
    }

    /**
     * Elemento sem valor na origem e omitido, nunca preenchido com texto vazio ou
     * marcador. Um CEP ausente e informacao; um CEP igual a string vazia e ruido.
     */
    private void aplicarEndereco(Patient patient, PacienteLegado origem) {
        EnderecoLegado endereco = origem.enderecoPrincipal();
        if (endereco == null) {
            return;
        }
        Address address = new Address().setCountry("BR");

        if (endereco.logradouro() != null) {
            address.addLine(endereco.numero() == null
                    ? endereco.logradouro()
                    : endereco.logradouro() + ", " + endereco.numero());
        }
        if (endereco.complemento() != null) {
            address.addLine(endereco.complemento());
        }
        if (endereco.bairro() != null) {
            address.setDistrict(endereco.bairro());
        }
        if (endereco.municipio() != null) {
            address.setCity(endereco.municipio());
        }
        if (endereco.uf() != null) {
            address.setState(endereco.uf());
        }
        if (endereco.cep() != null) {
            address.setPostalCode(endereco.cep());
        }
        patient.addAddress(address);
    }
}
