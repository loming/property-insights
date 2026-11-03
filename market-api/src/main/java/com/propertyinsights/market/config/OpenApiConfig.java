package com.propertyinsights.market.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.core.jackson.ModelResolver;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    /**
     * Schemas from the app's own ObjectMapper. springdoc otherwise uses swagger-core's, which ignores
     * spring.jackson.property-naming-strategy: Swagger would show camelCase fields, and "Try it out" would
     * send names this API rejects as unknown.
     */
    @Bean
    ModelResolver snakeCaseSchemas(ObjectMapper objectMapper) {
        return new ModelResolver(objectMapper);
    }

    @Bean
    OpenAPI marketOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Property market API")
                .version("1.0.0")
                .description("""
                        Backend of the **Property Market Analysis** dashboard (Task 2, App 2), on Spring Boot 3.4.4 \
                        and Java 21.

                        * **Market statistics** over the 50-home dataset: summary, segments, segment medians, \
                        distribution, correlations and a sortable, pageable property list. Every one takes the \
                        same snake_case segment filters, and results are cached.
                        * **What-if** through the Task 1 model: a baseline home against a changed one, or one \
                        feature swept across a range. Cached for 10 minutes per model version.
                        * **Export** of the filtered view as CSV or a PDF report.

                        Errors are RFC 9457 `application/problem+json` with a `request_id`. Cache statistics are at \
                        `/actuator/caches` and `/actuator/metrics/cache.gets`."""));
    }
}
