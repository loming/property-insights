package com.propertyinsights.market.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.propertyinsights.market.analytics.MarketFilter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class ExportControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void csvHasAHeaderAndTheFilteredRowsInOrder() throws Exception {
        MvcResult result = mvc.perform(get("/api/v1/market/export/csv").param("bedrooms", "2").param("sort", "price,desc"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.matchesPattern("attachment; filename=\"property-market-\\d{4}-\\d{2}-\\d{2}\\.csv\"")))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().doesNotExist("ETag"))
                .andReturn();
        List<String> lines = result.getResponse().getContentAsString(StandardCharsets.UTF_8).lines().toList();
        assertThat(lines.getFirst()).isEqualTo(
                "id,square_footage,bedrooms,bathrooms,year_built,lot_size,distance_to_city_center,school_rating,price,price_per_sqft");
        assertThat(lines).hasSize(1 + 13);
        List<Integer> prices = lines.stream().skip(1).map(l -> Integer.parseInt(l.split(",")[8])).toList();
        assertThat(prices).isSortedAccordingTo((a, b) -> b - a);
    }

    @Test
    void pdfIsAPdf() throws Exception {
        MvcResult result = mvc.perform(get("/api/v1/market/export/pdf").param("min_price", "300000"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();
        byte[] body = result.getResponse().getContentAsByteArray();
        assertThat(new String(body, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(body.length).isGreaterThan(1_000);
    }

    @Test
    void exportsValidateTheirFilters() throws Exception {
        mvc.perform(get("/api/v1/market/export/csv").param("min_price", "9").param("max_price", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/market/export/pdf").param("sort", "nope")).andExpect(status().isBadRequest());
    }

    @Test
    void aggregatesGetEtagsAndRevalidateTo304() throws Exception {
        String etag = mvc.perform(get("/api/v1/market/summary"))
                .andExpect(header().exists("ETag"))
                .andReturn().getResponse().getHeader("ETag");
        mvc.perform(get("/api/v1/market/summary").header("If-None-Match", etag)).andExpect(status().isNotModified());
    }

    @Test
    void filtersAreDescribedInWords() {
        assertThat(ExportController.describe(MarketFilter.NONE)).isEqualTo("none (the whole market)");
        MarketFilter filter = new MarketFilter(List.of(3, 2), null, null, 200_000.0, null, null, null, null, null, null,
                null, null, 5.5);
        assertThat(ExportController.describe(filter)).isEqualTo("bedrooms [2, 3]; price 200000 to any; miles to centre any to 5.5");
    }
}
