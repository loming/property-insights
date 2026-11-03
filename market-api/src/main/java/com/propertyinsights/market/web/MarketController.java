package com.propertyinsights.market.web;

import com.propertyinsights.market.analytics.DistributionMetric;
import com.propertyinsights.market.analytics.MarketAnalytics;
import com.propertyinsights.market.analytics.MarketFilter;
import com.propertyinsights.market.analytics.MarketViews.Correlation;
import com.propertyinsights.market.analytics.MarketViews.FilterOptions;
import com.propertyinsights.market.analytics.MarketViews.Histogram;
import com.propertyinsights.market.analytics.MarketViews.PropertyPage;
import com.propertyinsights.market.analytics.MarketViews.SegmentMedians;
import com.propertyinsights.market.analytics.MarketViews.Segments;
import com.propertyinsights.market.analytics.MarketViews.Summary;
import com.propertyinsights.market.analytics.SegmentBy;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.util.List;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market")
@Tag(name = "market", description = "Aggregate statistics over the housing dataset, filtered by segment")
public class MarketController {

    /** Browsers and the portal may reuse aggregate responses for 5 minutes; ETags make revalidation cheap. */
    private static final CacheControl FIVE_MINUTES = CacheControl.maxAge(Duration.ofMinutes(5));

    private final MarketAnalytics analytics;

    public MarketController(MarketAnalytics analytics) {
        this.analytics = analytics;
    }

    @GetMapping("/summary")
    @Operation(summary = "Count, price statistics and averages for the filtered market")
    public ResponseEntity<Summary> summary(@ParameterObject @Valid MarketFilter filter) {
        return cached(analytics.summary(filter));
    }

    @GetMapping("/segments")
    @Operation(summary = "Per-segment count, mean and median price, and price per sq ft")
    public ResponseEntity<Segments> segments(
            @RequestParam @Parameter(schema = @Schema(allowableValues = {
                    "bedrooms", "bathrooms", "decade", "school_band", "distance_band"})) SegmentBy by,
            @ParameterObject @Valid MarketFilter filter) {
        return cached(analytics.segments(by, filter));
    }

    @GetMapping("/segments/medians")
    @Operation(summary = "Each segment's median home (all 7 features): the what-if baselines")
    public ResponseEntity<SegmentMedians> segmentMedians(
            @RequestParam @Parameter(schema = @Schema(allowableValues = {
                    "bedrooms", "bathrooms", "decade", "school_band", "distance_band"})) SegmentBy by,
            @ParameterObject @Valid MarketFilter filter) {
        return cached(analytics.segmentMedians(by, filter));
    }

    @GetMapping("/distribution")
    @Operation(summary = "Histogram of price or price per sq ft")
    public ResponseEntity<Histogram> distribution(
            @RequestParam(defaultValue = "price")
                    @Parameter(schema = @Schema(allowableValues = {"price", "price_per_sqft"}))
                    DistributionMetric metric,
            @RequestParam(defaultValue = "8") @Min(2) @Max(20) int bins,
            @ParameterObject @Valid MarketFilter filter) {
        return cached(analytics.distribution(metric, bins, filter));
    }

    @GetMapping("/correlations")
    @Operation(summary = "Each feature's correlation with price, strongest first")
    public ResponseEntity<List<Correlation>> correlations() {
        return cached(analytics.correlations());
    }

    @GetMapping("/properties")
    @Operation(summary = "The filtered properties, sorted and paged, with price per sq ft")
    public ResponseEntity<PropertyPage> properties(
            @ParameterObject @Valid MarketFilter filter,
            @RequestParam(defaultValue = "id,asc")
                    @Pattern(
                            regexp = "(id|price|price_per_sqft|square_footage|bedrooms|bathrooms|year_built|lot_size"
                                    + "|distance_to_city_center|school_rating),(asc|desc)",
                            message = "sort must be <field>,asc or <field>,desc")
                    String sort,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return cached(analytics.properties(filter, sort, page, size));
    }

    @GetMapping("/filter-options")
    @Operation(summary = "Bounds and segment values for building the filter UI")
    public ResponseEntity<FilterOptions> filterOptions() {
        return cached(analytics.filterOptions());
    }

    private static <T> ResponseEntity<T> cached(T body) {
        return ResponseEntity.ok().cacheControl(FIVE_MINUTES).body(body);
    }
}
