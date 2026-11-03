package com.propertyinsights.market.analytics;

import com.propertyinsights.market.data.Property;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.BindParam;

/**
 * Market segment filters, bound from snake_case query parameters. Immutable, so it doubles as the cache
 * key. {@code @BindParam} sets the bound name and {@code @Parameter} makes Swagger send the same one;
 * springdoc ignores {@code @BindParam}, so without both the filters would silently do nothing (doc 02, D3).
 */
public record MarketFilter(
        @BindParam("bedrooms") @Parameter(name = "bedrooms", description = "Repeat for several: bedrooms=2&bedrooms=3")
                @Size(max = 10) List<@Min(0) @Max(20) Integer> bedrooms,
        @BindParam("min_bathrooms") @Parameter(name = "min_bathrooms") @PositiveOrZero Double minBathrooms,
        @BindParam("max_bathrooms") @Parameter(name = "max_bathrooms") @PositiveOrZero Double maxBathrooms,
        @BindParam("min_price") @Parameter(name = "min_price") @PositiveOrZero Double minPrice,
        @BindParam("max_price") @Parameter(name = "max_price") @PositiveOrZero Double maxPrice,
        @BindParam("min_sqft") @Parameter(name = "min_sqft") @PositiveOrZero Double minSqft,
        @BindParam("max_sqft") @Parameter(name = "max_sqft") @PositiveOrZero Double maxSqft,
        @BindParam("min_year") @Parameter(name = "min_year") @Min(1800) @Max(2100) Integer minYear,
        @BindParam("max_year") @Parameter(name = "max_year") @Min(1800) @Max(2100) Integer maxYear,
        @BindParam("min_school_rating") @Parameter(name = "min_school_rating") @PositiveOrZero @Max(10)
                Double minSchoolRating,
        @BindParam("max_school_rating") @Parameter(name = "max_school_rating") @PositiveOrZero @Max(10)
                Double maxSchoolRating,
        @BindParam("min_distance") @Parameter(name = "min_distance") @PositiveOrZero Double minDistance,
        @BindParam("max_distance") @Parameter(name = "max_distance") @PositiveOrZero Double maxDistance) {

    public static final MarketFilter NONE =
            new MarketFilter(null, null, null, null, null, null, null, null, null, null, null, null, null);

    public MarketFilter {
        // Copied and sorted, so bedrooms=3&bedrooms=2 and bedrooms=2&bedrooms=3 share a cache key (doc 02, D4).
        bedrooms = bedrooms == null
                ? List.of()
                : bedrooms.stream().filter(b -> b != null).distinct().sorted().toList();
    }

    public boolean matches(Property p) {
        return (bedrooms.isEmpty() || bedrooms.contains(p.bedrooms()))
                && within(p.bathrooms(), minBathrooms, maxBathrooms)
                && within(p.price(), minPrice, maxPrice)
                && within(p.squareFootage(), minSqft, maxSqft)
                && within(p.yearBuilt(), minYear == null ? null : minYear.doubleValue(),
                        maxYear == null ? null : maxYear.doubleValue())
                && within(p.schoolRating(), minSchoolRating, maxSchoolRating)
                && within(p.distanceToCityCenter(), minDistance, maxDistance);
    }

    /** Not named isEmpty(): springdoc and Bean Validation would treat that as a property. */
    public boolean hasNoCriteria() {
        return equals(NONE);
    }

    private static boolean within(double value, Double min, Double max) {
        return (min == null || value >= min) && (max == null || value <= max);
    }

    @AssertTrue(message = "each min_* must not exceed the matching max_*")
    @Parameter(hidden = true)
    public boolean isRangesOrdered() {
        return ordered(minBathrooms, maxBathrooms)
                && ordered(minPrice, maxPrice)
                && ordered(minSqft, maxSqft)
                && ordered(minYear == null ? null : minYear.doubleValue(), maxYear == null ? null : maxYear.doubleValue())
                && ordered(minSchoolRating, maxSchoolRating)
                && ordered(minDistance, maxDistance);
    }

    private static boolean ordered(Double min, Double max) {
        return min == null || max == null || min <= max;
    }
}
