package com.propertyinsights.market.whatif;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.propertyinsights.market.data.Feature;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** What-if requests and results. Records, so a request can be (part of) a cache key. */
public final class WhatIfViews {

    private WhatIfViews() {}

    public record WhatIfRequest(@NotNull @Valid HouseFeatures baseline, @NotNull @Valid FeatureChanges changes) {}

    public record ModelWarning(String code, String field, Double value, String message) {}

    public record WhatIfResult(
            HouseFeatures baseline,
            HouseFeatures scenario,
            double baselinePrice,
            double scenarioPrice,
            double delta,
            @Schema(description = "Change as a percentage of the baseline price") double deltaPct,
            List<ModelWarning> baselineWarnings,
            List<ModelWarning> scenarioWarnings,
            String modelVersion) {}

    public record SensitivityRequest(
            @NotNull @Valid HouseFeatures baseline,
            @NotNull @Schema(example = "square_footage") String feature,
            @NotNull Double from,
            @NotNull Double to,
            @Min(2) @Max(50) int steps) {

        @JsonIgnore
        @Schema(hidden = true)
        @AssertTrue(message = "feature must be one of the model's 7 features, e.g. square_footage")
        public boolean isKnownFeature() {
            return feature == null || Feature.fromKey(feature).isPresent();
        }

        @JsonIgnore
        @Schema(hidden = true)
        @AssertTrue(message = "from and to must be within the feature's allowed range")
        public boolean isWithinLimits() {
            return Feature.fromKey(feature)
                    .map(f -> from == null || to == null
                            || (Math.min(from, to) >= f.hardMin() && Math.max(from, to) <= f.hardMax()))
                    .orElse(true);
        }
    }

    public record Point(double value, double predictedPrice, List<ModelWarning> warnings) {}

    public record SensitivityResult(String feature, List<Point> points, String modelVersion) {}
}
