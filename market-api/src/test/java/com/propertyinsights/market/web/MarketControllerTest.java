package com.propertyinsights.market.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.github.benmanes.caffeine.cache.Cache;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.test.web.servlet.MockMvc;

/** The analytics endpoints against the real dataset (doc 01 §2.1: 13 / 22 / 15 homes with 2 / 3 / 4 bedrooms). */
@SpringBootTest
@AutoConfigureMockMvc
class MarketControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    CacheManager caches;

    @Test
    void summaryOfTheWholeMarket() throws Exception {
        mvc.perform(get("/api/v1/market/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(50))
                .andExpect(jsonPath("$.price.mean").value(264_600.0))
                .andExpect(jsonPath("$.price.median").value(245_000.0))
                .andExpect(jsonPath("$.price.min").value(160_000.0))
                .andExpect(jsonPath("$.price.max").value(410_000.0))
                .andExpect(jsonPath("$.mean_price_per_sqft").isNumber())
                .andExpect(header().string("Cache-Control", "max-age=300"));
    }

    @Test
    void snakeCaseFiltersBind() throws Exception {
        mvc.perform(get("/api/v1/market/summary").param("bedrooms", "2")).andExpect(jsonPath("$.count").value(13));
        mvc.perform(get("/api/v1/market/summary").param("bedrooms", "4", "2")).andExpect(jsonPath("$.count").value(28));
        mvc.perform(get("/api/v1/market/summary").param("min_price", "300000").param("max_price", "350000"))
                .andExpect(jsonPath("$.price.min").value(org.hamcrest.Matchers.greaterThanOrEqualTo(300_000.0)))
                .andExpect(jsonPath("$.price.max").value(org.hamcrest.Matchers.lessThanOrEqualTo(350_000.0)));
    }

    @Test
    void segmentsByBedrooms() throws Exception {
        mvc.perform(get("/api/v1/market/segments").param("by", "bedrooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.by").value("bedrooms"))
                .andExpect(jsonPath("$.segments[*].segment", contains("2 bed", "3 bed", "4 bed")))
                .andExpect(jsonPath("$.segments[*].count", contains(13, 22, 15)));
    }

    @Test
    void segmentMediansAreCompleteHomes() throws Exception {
        mvc.perform(get("/api/v1/market/segments/medians").param("by", "school_band"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segments[0].features.square_footage").isNumber())
                .andExpect(jsonPath("$.segments[0].features.school_rating").isNumber());
    }

    @Test
    void propertiesSortAndPage() throws Exception {
        mvc.perform(get("/api/v1/market/properties").param("sort", "price,desc").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(50))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].price").value(410_000))
                .andExpect(jsonPath("$.items[0].price_per_sqft").isNumber());
    }

    @Test
    void otherEndpoints() throws Exception {
        mvc.perform(get("/api/v1/market/distribution").param("metric", "price_per_sqft").param("bins", "5"))
                .andExpect(jsonPath("$.bins", hasSize(5)))
                .andExpect(jsonPath("$.count").value(50));
        mvc.perform(get("/api/v1/market/correlations")).andExpect(jsonPath("$", hasSize(7)));
        mvc.perform(get("/api/v1/market/filter-options"))
                .andExpect(jsonPath("$.ranges.square_footage.min").value(980.0))
                .andExpect(jsonPath("$.bedrooms", contains(2, 3, 4)));
    }

    @Test
    void invalidInputIsA400() throws Exception {
        mvc.perform(get("/api/v1/market/segments").param("by", "colour")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/summary").param("min_price", "300000").param("max_price", "200000"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/summary").param("min_price", "cheap")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/summary").param("bedrooms", "25")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/properties").param("sort", "colour,asc")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/properties").param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/distribution").param("bins", "1")).andExpect(status().isBadRequest());
    }

    @Test
    void repeatedQueriesAreServedFromTheCache() throws Exception {
        Cache<Object, Object> summary = ((CaffeineCache) caches.getCache("summary")).getNativeCache();
        long hits = summary.stats().hitCount();
        mvc.perform(get("/api/v1/market/summary").param("bedrooms", "3", "2"));
        mvc.perform(get("/api/v1/market/summary").param("bedrooms", "2", "3"));
        assertThat(summary.stats().hitCount() - hits).isEqualTo(1);
    }
}
