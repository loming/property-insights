package com.propertyinsights.market.web;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.propertyinsights.market.whatif.HouseFeatures;
import com.propertyinsights.market.whatif.MlApiException;
import com.propertyinsights.market.whatif.MlClient;
import com.propertyinsights.market.whatif.MlClient.BatchPrediction;
import com.propertyinsights.market.whatif.MlClient.Prediction;
import com.propertyinsights.market.whatif.WhatIfViews.ModelWarning;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class WhatIfControllerTest {

    static final String HOME = """
            {"square_footage": 1550, "bedrooms": 3, "bathrooms": 2, "year_built": 1997, "lot_size": 6800,
             "distance_to_city_center": 4.1, "school_rating": 7.6}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    CacheManager caches;

    @MockitoBean
    MlClient ml;

    @BeforeEach
    void setUp() {
        caches.getCacheNames().forEach(name -> caches.getCache(name).clear());
        when(ml.modelInfo()).thenReturn(Map.of("model_type", "linear_regression", "model_version", "ols-test"));
    }

    ResultActions postJson(String path, String body) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    static BatchPrediction prices(double... prices) {
        List<Prediction> predictions = new java.util.ArrayList<>();
        for (int i = 0; i < prices.length; i++) {
            predictions.add(new Prediction(i, prices[i], List.of()));
        }
        return new BatchPrediction(prices.length, "ols-test", predictions);
    }

    @Test
    void whatIfPricesBothHomesInOneCallHoldingTheRestConstant() throws Exception {
        ModelWarning warning = new ModelWarning("UNUSUAL_COMBINATION", null, 6.2, "m");
        when(ml.predictBatch(any())).thenReturn(new BatchPrediction(2, "ols-test", List.of(
                new Prediction(0, 250_000, List.of()), new Prediction(1, 260_000, List.of(warning)))));
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME + ", \"changes\": {\"square_footage\": 2000}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseline_price").value(250_000.0))
                .andExpect(jsonPath("$.scenario_price").value(260_000.0))
                .andExpect(jsonPath("$.delta").value(10_000.0))
                .andExpect(jsonPath("$.delta_pct").value(4.0))
                .andExpect(jsonPath("$.scenario.square_footage").value(2000))
                .andExpect(jsonPath("$.scenario.bedrooms").value(3))
                .andExpect(jsonPath("$.scenario_warnings[0].code").value("UNUSUAL_COMBINATION"))
                .andExpect(jsonPath("$.model_version").value("ols-test"));
        verify(ml).predictBatch(argThat(items -> items.size() == 2
                && items.get(0).squareFootage() == 1550
                && items.get(1).squareFootage() == 2000
                && items.get(1).schoolRating() == 7.6));
    }

    @Test
    void repeatedWhatIfsAreCached() throws Exception {
        when(ml.predictBatch(any())).thenReturn(prices(250_000, 255_000));
        String body = "{\"baseline\": " + HOME + ", \"changes\": {\"school_rating\": 8.5}}";
        postJson("/api/v1/market/what-if", body).andExpect(status().isOk());
        postJson("/api/v1/market/what-if", body).andExpect(status().isOk());
        verify(ml, times(1)).predictBatch(any());
        verify(ml, times(1)).modelInfo();
    }

    @Test
    void sensitivitySweepsOneFeatureInOneCall() throws Exception {
        when(ml.predictBatch(any())).thenReturn(prices(200_000, 210_000, 220_000));
        postJson("/api/v1/market/what-if/sensitivity",
                "{\"baseline\": " + HOME + ", \"feature\": \"square_footage\", \"from\": 1000, \"to\": 2000, \"steps\": 3}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feature").value("square_footage"))
                .andExpect(jsonPath("$.points[*].value", contains(1000.0, 1500.0, 2000.0)))
                .andExpect(jsonPath("$.points[2].predicted_price").value(220_000.0));
        verify(ml).predictBatch(argThat(items -> items.size() == 3 && items.get(1).squareFootage() == 1500));
    }

    @Test
    void invalidInputIsRejectedBeforeAnyModelCall() throws Exception {
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME.replace("\"bathrooms\": 2", "\"bathrooms\": 2.25")
                + ", \"changes\": {}}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("validation-error"))
                .andExpect(jsonPath("$.errors[*].field", hasItem(containsString("baseline.bathrooms"))));
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME + ", \"changes\": {\"square_footage\": 50}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("changes.square_footage"));
        // 3.5 bedrooms must not silently become 3.
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME.replace("\"bedrooms\": 3", "\"bedrooms\": 3.5")
                + ", \"changes\": {}}").andExpect(status().isBadRequest());
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME + ", \"changes\": {\"sqft\": 1}}")
                .andExpect(status().isBadRequest());
        postJson("/api/v1/market/what-if/sensitivity",
                "{\"baseline\": " + HOME + ", \"feature\": \"colour\", \"from\": 1, \"to\": 2, \"steps\": 3}")
                .andExpect(status().isBadRequest());
        postJson("/api/v1/market/what-if/sensitivity",
                "{\"baseline\": " + HOME + ", \"feature\": \"square_footage\", \"from\": 50, \"to\": 2000, \"steps\": 3}")
                .andExpect(status().isBadRequest());
        postJson("/api/v1/market/what-if/sensitivity",
                "{\"baseline\": " + HOME + ", \"feature\": \"square_footage\", \"from\": 1000, \"to\": 2000, \"steps\": 51}")
                .andExpect(status().isBadRequest());
        verify(ml, times(0)).predictBatch(any());
    }

    @Test
    void aHomeTheModelCantPriceIsNamed() throws Exception {
        when(ml.predictBatch(any())).thenThrow(MlApiException.rejected("outside-model-domain", "d", null, List.of(1)));
        postJson("/api/v1/market/what-if", "{\"baseline\": " + HOME + ", \"changes\": {\"square_footage\": 4100}}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value("outside-model-domain"))
                .andExpect(jsonPath("$.detail", containsString("scenario")))
                .andExpect(jsonPath("$.indices[0]").value(1));
    }

    @Test
    void modelDownIsA503WithTheRequestId() throws Exception {
        when(ml.predictBatch(any())).thenThrow(MlApiException.unavailable("The model service can't be reached", null));
        mvc.perform(post("/api/v1/market/what-if").contentType(MediaType.APPLICATION_JSON).header("X-Request-ID", "abc-9")
                        .content("{\"baseline\": " + HOME + ", \"changes\": {}}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("X-Request-ID", "abc-9"))
                .andExpect(jsonPath("$.type").value("model-unavailable"))
                .andExpect(jsonPath("$.request_id").value("abc-9"));
    }

    @Test
    void modelInfoIsPassedThroughAndCached() throws Exception {
        mvc.perform(get("/api/v1/market/model-info")).andExpect(jsonPath("$.model_version").value("ols-test"));
        mvc.perform(get("/api/v1/market/model-info")).andExpect(jsonPath("$.model_type", notNullValue()));
        verify(ml, times(1)).modelInfo();
    }

    @Test
    void houseFeaturesRoundSensitivityValues() {
        HouseFeatures home = new HouseFeatures(1550, 3, 2.0, 1997, 6800.0, 4.1, 7.6);
        org.assertj.core.api.Assertions.assertThat(
                home.with(com.propertyinsights.market.data.Feature.BATHROOMS, 2.3).bathrooms()).isEqualTo(2.5);
        org.assertj.core.api.Assertions.assertThat(
                home.with(com.propertyinsights.market.data.Feature.SQUARE_FOOTAGE, 1666.6).squareFootage()).isEqualTo(1667);
    }
}
