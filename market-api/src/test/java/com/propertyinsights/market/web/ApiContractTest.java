package com.propertyinsights.market.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** What clients see beyond the happy path: the OpenAPI document, problem+json, request IDs, Actuator. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiContractTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    /** springdoc ignores @BindParam: without @Parameter(name) Swagger would send camelCase that binds nothing. */
    @Test
    void swaggerDocumentsTheFilterNamesThatBind() throws Exception {
        JsonNode docs = json.readTree(mvc.perform(get("/v3/api-docs")).andReturn().getResponse().getContentAsString());
        List<String> names = new ArrayList<>();
        docs.at("/paths/~1api~1v1~1market~1summary/get/parameters").forEach(p -> names.add(p.get("name").asText()));
        assertThat(names).containsExactlyInAnyOrder(
                "bedrooms", "min_bathrooms", "max_bathrooms", "min_price", "max_price", "min_sqft", "max_sqft",
                "min_year", "max_year", "min_school_rating", "max_school_rating", "min_distance", "max_distance");
        // Bodies too: springdoc must use the app's snake_case ObjectMapper, or "Try it out" sends camelCase.
        JsonNode house = docs.at("/components/schemas/HouseFeatures/properties");
        assertThat(house.has("square_footage")).isTrue();
        assertThat(house.has("squareFootage")).isFalse();
        assertThat(house.has("bathrooms_in_half_steps")).isFalse();
        assertThat(docs.at("/components/schemas/Summary/properties").has("mean_price_per_sqft")).isTrue();
        assertThat(docs.at("/components/schemas/WhatIfResult/properties").has("scenario_price")).isTrue();
    }

    @Test
    void springsOwnErrorsAreProblemsToo() throws Exception {
        mvc.perform(get("/api/v1/market/nope"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("not-found"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
        mvc.perform(put("/api/v1/market/summary"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.type").value("method-not-allowed"));
        mvc.perform(get("/api/v1/market/segments"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("by"))
                .andExpect(jsonPath("$.errors[0].message").value("is required"));
        mvc.perform(get("/api/v1/market/segments").param("by", "colour"))
                .andExpect(jsonPath("$.errors[0].message").value(org.hamcrest.Matchers.startsWith("by must be one of")));
        mvc.perform(get("/api/v1/market/summary").param("min_price", "cheap"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("min_price")));
    }

    @Test
    void requestIdsAreEchoedOrGenerated() throws Exception {
        mvc.perform(get("/api/v1/market/correlations").header("X-Request-ID", "demo-1"))
                .andExpect(header().string("X-Request-ID", "demo-1"));
        mvc.perform(get("/api/v1/market/correlations").header("X-Request-ID", "not <safe>"))
                .andExpect(header().string("X-Request-ID", matchesPattern("[0-9a-f]{32}")));
    }

    @Test
    void actuatorShowsCachesReadOnly() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/actuator/caches")).andExpect(jsonPath("$.cacheManagers.cacheManager.caches.summary").exists());
        mvc.perform(get("/actuator/metrics/cache.gets").param("tag", "name:summary")).andExpect(status().isOk());
        int deleteStatus = mvc.perform(delete("/actuator/caches")).andReturn().getResponse().getStatus();
        assertThat(deleteStatus).isIn(404, 405);
        mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
    }

    @Test
    void rootOpensSwagger() throws Exception {
        mvc.perform(get("/")).andExpect(redirectedUrl("/swagger-ui.html"));
    }
}
