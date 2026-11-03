package com.propertyinsights.market.whatif;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.propertyinsights.market.config.MarketProperties;
import com.propertyinsights.market.whatif.WhatIfViews.ModelWarning;
import java.io.IOException;
import java.net.ConnectException;
import java.net.http.HttpConnectTimeoutException;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/** The only way this service reaches the model: Task 1's HTTP contract (doc 03 §1). */
@Component
public class MlClient {

    public static final String REQUEST_ID_MDC_KEY = "request_id";
    private static final Logger log = LoggerFactory.getLogger(MlClient.class);

    public record Prediction(int index, double predictedPrice, List<ModelWarning> warnings) {}

    public record BatchPrediction(int count, String modelVersion, List<Prediction> predictions) {}

    private final RestClient client;
    private final ObjectMapper json;
    private final int retries;

    /** Timeouts come from spring.http.client.* on the auto-configured builder (2 s connect, 5 s read). */
    public MlClient(RestClient.Builder builder, ObjectMapper json, MarketProperties settings) {
        // Lenient about fields ml-api may add later; this service's own API stays strict.
        this.json = json.copy().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.retries = settings.mlRetries();
        this.client = builder
                .baseUrl(settings.mlApiUrl())
                .requestInterceptor((request, body, execution) -> {
                    String requestId = MDC.get(REQUEST_ID_MDC_KEY);
                    if (requestId != null) {
                        request.getHeaders().set("X-Request-ID", requestId);
                    }
                    return execution.execute(request, body);
                })
                .build();
    }

    public BatchPrediction predictBatch(List<HouseFeatures> items) {
        return withRetries(() -> client.post()
                .uri("/predict/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("items", items))
                .exchange((request, response) -> {
                    int status = response.getStatusCode().value();
                    if (status == 200) {
                        BatchPrediction batch = read(response, new TypeReference<>() {});
                        if (batch.predictions() == null || batch.predictions().size() != items.size()) {
                            throw MlApiException.badResponse("ml-api returned the wrong number of predictions");
                        }
                        return batch;
                    }
                    if (status == 422) {
                        throw rejected(read(response, new TypeReference<Map<String, Object>>() {}));
                    }
                    throw unexpected(status);
                }));
    }

    public Map<String, Object> modelInfo() {
        return withRetries(() -> client.get()
                .uri("/model-info")
                .exchange((request, response) -> {
                    int status = response.getStatusCode().value();
                    if (status == 200) {
                        return read(response, new TypeReference<Map<String, Object>>() {});
                    }
                    throw unexpected(status);
                }));
    }

    /** Retries only failures to connect: an answered request is never repeated (doc 02, C6). */
    private <T> T withRetries(Supplier<T> call) {
        for (int attempt = 0; ; attempt++) {
            try {
                return call.get();
            } catch (ResourceAccessException e) {
                if (isConnectFailure(e) && attempt < retries) {
                    log.warn("ml-api connection failed, retrying ({}/{})", attempt + 1, retries);
                    continue;
                }
                String detail = e.getCause() instanceof java.net.http.HttpTimeoutException
                        ? "The model service timed out"
                        : "The model service can't be reached";
                throw MlApiException.unavailable(detail, e);
            }
        }
    }

    private static boolean isConnectFailure(ResourceAccessException e) {
        return e.getCause() instanceof ConnectException || e.getCause() instanceof HttpConnectTimeoutException;
    }

    private <T> T read(ClientHttpResponse response, TypeReference<T> type) throws IOException {
        try {
            return json.readValue(response.getBody(), type);
        } catch (IOException e) {
            throw MlApiException.badResponse("ml-api returned a body that isn't the expected JSON");
        }
    }

    @SuppressWarnings("unchecked")
    private static MlApiException rejected(Map<String, Object> problem) {
        Object type = problem.get("type");
        if ("outside-model-domain".equals(type)) {
            List<Integer> indices = problem.get("indices") instanceof List<?> list
                    ? list.stream().map(i -> ((Number) i).intValue()).toList()
                    : List.of();
            return MlApiException.rejected("outside-model-domain",
                    String.valueOf(problem.getOrDefault("detail", "The model can't price this input")), null, indices);
        }
        if ("validation-error".equals(type)) {
            List<Map<String, String>> errors = problem.get("errors") instanceof List<?> list
                    ? list.stream().map(e -> (Map<String, String>) e).toList()
                    : List.of();
            return MlApiException.rejected("validation-error", "The model rejected some fields", errors, null);
        }
        return MlApiException.badResponse("ml-api answered 422 with an unknown problem type");
    }

    private static MlApiException unexpected(int status) {
        if (status == 503) {
            return MlApiException.unavailable("The model service is up but has no model loaded", null);
        }
        return MlApiException.badResponse("ml-api answered " + status);
    }
}
