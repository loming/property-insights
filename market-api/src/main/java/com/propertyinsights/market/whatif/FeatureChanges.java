package com.propertyinsights.market.whatif;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Year;

/** The features to change in a what-if; anything left out keeps the baseline's value. Same limits. */
@Schema(example = "{\"square_footage\": 2000, \"school_rating\": 8.5}")
public record FeatureChanges(
        @Min(200) @Max(20_000) Integer squareFootage,
        @Min(0) @Max(20) Integer bedrooms,
        @DecimalMin("0") @DecimalMax("20") Double bathrooms,
        @Min(1800) Integer yearBuilt,
        @DecimalMin("0") @DecimalMax("1000000") Double lotSize,
        @DecimalMin("0") @DecimalMax("200") Double distanceToCityCenter,
        @DecimalMin("0") @DecimalMax("10") Double schoolRating) {

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "bathrooms must be a multiple of 0.5")
    public boolean isBathroomsInHalfSteps() {
        return bathrooms == null || bathrooms * 2 == Math.rint(bathrooms * 2);
    }

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "year_built must not be in the future")
    public boolean isYearBuiltNotInTheFuture() {
        return yearBuilt == null || yearBuilt <= Year.now().getValue();
    }
}
