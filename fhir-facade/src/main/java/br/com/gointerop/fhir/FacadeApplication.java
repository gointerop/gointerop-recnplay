package br.com.gointerop.fhir;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Fachada FHIR R4 somente leitura sobre o cadastro de pacientes do SIGH. */
@SpringBootApplication
public class FacadeApplication {

    public static void main(String[] args) {
        SpringApplication.run(FacadeApplication.class, args);
    }
}
