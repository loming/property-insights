package com.propertyinsights.market.whatif;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.propertyinsights.market.data.Feature;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Year;

/** One property as the model sees it, with ml-api's hard limits, so bad input is a 400 before any model call. */
@Schema(example = """
        {"square_footage": 1550, "bedrooms": 3, "bathrooms": 2, "year_built": 1997, "lot_size": 6800,
         "distance_to_city_center": 4.1, "school_rating": 7.6}""")
public record HouseFeatures(
        @NotNull @Min(200) @Max(20_000) Integer squareFootage,
        @NotNull @Min(0) @Max(20) Integer bedrooms,
        @NotNull @DecimalMin("0") @DecimalMax("20") Double bathrooms,
        @NotNull @Min(1800) Integer yearBuilt,
        @NotNull @DecimalMin("0") @DecimalMax("1000000") Double lotSize,
        @NotNull @DecimalMin("0") @DecimalMax("200") Double distanceToCityCenter,
        @NotNull @DecimalMin("0") @DecimalMax("10") Double schoolRating) {

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

    /** This home with every given change applied. */
    public HouseFeatures apply(FeatureChanges c) {
        return new HouseFeatures(
                c.squareFootage() != null ? c.squareFootage() : squareFootage,
                c.bedrooms() != null ? c.bedrooms() : bedrooms,
                c.bathrooms() != null ? c.bathrooms() : bathrooms,
                c.yearBuilt() != null ? c.yearBuilt() : yearBuilt,
                c.lotSize() != null ? c.lotSize() : lotSize,
                c.distanceToCityCenter() != null ? c.distanceToCityCenter() : distanceToCityCenter,
                c.schoolRating() != null ? c.schoolRating() : schoolRating);
    }

    /** This home with one feature set to a value (rounded to one the model accepts). */
    public HouseFeatures with(Feature feature, double value) {
        double v = feature.toValid(value);
        return switch (feature) {
            case SQUARE_FOOTAGE -> new HouseFeatures((int) v, bedrooms, bathrooms, yearBuilt, lotSize,
                    distanceToCityCenter, schoolRating);
            case BEDROOMS -> new HouseFeatures(squareFootage, (int) v, bathrooms, yearBuilt, lotSize,
                    distanceToCityCenter, schoolRating);
            case BATHROOMS -> new HouseFeatures(squareFootage, bedrooms, v, yearBuilt, lotSize,
                    distanceToCityCenter, schoolRating);
            case YEAR_BUILT -> new HouseFeatures(squareFootage, bedrooms, bathrooms, (int) v, lotSize,
                    distanceToCityCenter, schoolRating);
            case LOT_SIZE -> new HouseFeatures(squareFootage, bedrooms, bathrooms, yearBuilt, v,
                    distanceToCityCenter, schoolRating);
            case DISTANCE_TO_CITY_CENTER -> new HouseFeatures(squareFootage, bedrooms, bathrooms, yearBuilt,
                    lotSize, v, schoolRating);
            case SCHOOL_RATING -> new HouseFeatures(squareFootage, bedrooms, bathrooms, yearBuilt, lotSize,
                    distanceToCityCenter, v);
        };
    }
}
