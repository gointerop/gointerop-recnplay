package br.com.gointerop.fhir.config;

import br.com.gointerop.fhir.fhir.PatientResourceProvider;
import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.openapi.OpenApiInterceptor;
import ca.uhn.fhir.rest.server.RestfulServer;
import ca.uhn.fhir.rest.server.interceptor.ResponseHighlighterInterceptor;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Registra o servidor FHIR no padrao Plain Server do HAPI.
 *
 * <p>Plain Server, e nao JPA Server: o JPA Server traz um repositorio FHIR com
 * persistencia propria, o que exigiria migrar o cadastro — proibido pelas restricoes
 * RNF-03 e RA-01. Aqui o recurso e montado em memoria a cada requisicao, direto da
 * origem. A fachada e um tradutor, nao um repositorio.
 */
@Configuration
public class FhirServerConfig {

    /** Caminho base do servidor FHIR. */
    public static final String BASE = "/fhir";

    @Bean
    public FhirContext fhirContext() {
        return FhirContext.forR4();
    }

    @Bean
    public ServletRegistrationBean<RestfulServer> fhirServlet(
            FhirContext contexto, PatientResourceProvider provider) {

        RestfulServer servidor = new RestfulServer(contexto);
        servidor.setResourceProviders(List.of(provider));
        servidor.setDefaultPrettyPrint(true);

        // Gera /fhir/api-docs e serve o Swagger UI em /fhir/swagger-ui/, a partir do
        // CapabilityStatement que o proprio servidor monta.
        servidor.registerInterceptor(new OpenApiInterceptor());

        // Resposta legivel quando aberta no navegador, sem alterar o retorno para
        // clientes que pedem JSON ou XML.
        servidor.registerInterceptor(new ResponseHighlighterInterceptor());

        ServletRegistrationBean<RestfulServer> registro =
                new ServletRegistrationBean<>(servidor, BASE + "/*");
        registro.setName("fhir");
        registro.setLoadOnStartup(1);
        return registro;
    }
}
