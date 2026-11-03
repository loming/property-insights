package com.propertyinsights.market.whatif;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.propertyinsights.market.config.MarketProperties;
import com.propertyinsights.market.whatif.MlClient.BatchPrediction;
import java.net.ConnectException;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;

@RestClientTest(MlClient.class)
@EnableConfigurationProperties(MarketProperties.class)
class MlClientTest {

    static final HouseFeatures HOME = new HouseFeatures(1550, 3, 2.0, 1997, 6800.0, 4.1, 7.6);
    static final String BATCH = "http://ml-api.test/predict/batch";

    @Autowired
    MlClient client;

    @Autowired
    MockRestServiceServer server;

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void sendsSnakeCaseWithTheRequestIdAndParsesTheBatch() {
        server.expect(requestTo(BATCH))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Request-ID", "trace-7"))
                .andExpect(jsonPath("$.items[0].square_footage").value(1550))
                .andExpect(jsonPath("$.items[0].distance_to_city_center").value(4.1))
                .andRespond(withSuccess("""
                        {"count": 1, "model_version": "ols-x", "future_field": true,
                         "predictions": [{"index": 0, "predicted_price": 250879.73,
                           "warnings": [{"code": "UNUSUAL_COMBINATION", "value": 6.2, "message": "m"}]}]}""",
                        MediaType.APPLICATION_JSON));
        MDC.put(MlClient.REQUEST_ID_MDC_KEY, "trace-7");
        BatchPrediction batch = client.predictBatch(List.of(HOME));
        assertThat(batch.modelVersion()).isEqualTo("ols-x");
        assertThat(batch.predictions().getFirst().predictedPrice()).isEqualTo(250_879.73);
        assertThat(batch.predictions().getFirst().warnings().getFirst().code()).isEqualTo("UNUSUAL_COMBINATION");
        server.verify();
    }

    @Test
    void outsideModelDomainKeepsTheIndices() {
        server.expect(requestTo(BATCH)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body("{\"type\": \"outside-model-domain\", \"detail\": \"Can't price it\", \"indices\": [1]}"));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME, HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(e.type()).isEqualTo("outside-model-domain");
                    assertThat(e.indices()).containsExactly(1);
                });
    }

    @Test
    void modelValidationErrorsPassThrough() {
        server.expect(requestTo(BATCH)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body("{\"type\": \"validation-error\", \"errors\": [{\"field\": \"items[0].bathrooms\", \"message\": \"m\"}]}"));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> {
                    assertThat(e.type()).isEqualTo("validation-error");
                    assertThat(e.errors()).hasSize(1);
                });
    }

    @Test
    void serverErrorsAndGarbageAreModelErrors() {
        server.expect(requestTo(BATCH)).andRespond(withServerError());
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> assertThat(e.type()).isEqualTo("model-error"));
        server.reset();
        server.expect(requestTo(BATCH)).andRespond(withSuccess("<html>proxy error</html>", MediaType.TEXT_HTML));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_GATEWAY));
        server.reset();
        server.expect(requestTo(BATCH)).andRespond(withSuccess(
                "{\"count\": 0, \"model_version\": \"v\", \"predictions\": []}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> assertThat(e.getMessage()).contains("wrong number"));
    }

    @Test
    void noModelLoadedIsUnavailable() {
        server.expect(requestTo(BATCH)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> assertThat(e.type()).isEqualTo("model-unavailable"));
    }

    @Test
    void connectionFailuresAreRetriedTwiceThenUnavailable() {
        server.expect(ExpectedCount.times(3), requestTo(BATCH)).andRespond(withException(new ConnectException("refused")));
        assertThatThrownBy(() -> client.predictBatch(List.of(HOME)))
                .isInstanceOfSatisfying(MlApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(e.getMessage()).contains("can't be reached");
                });
        server.verify();
    }

    @Test
    void modelInfo() {
        server.expect(requestTo("http://ml-api.test/model-info"))
                .andRespond(withSuccess("{\"model_type\": \"ridge\", \"model_version\": \"ridge-x\"}", MediaType.APPLICATION_JSON));
        assertThat(client.modelInfo()).containsEntry("model_version", "ridge-x");
    }
}
