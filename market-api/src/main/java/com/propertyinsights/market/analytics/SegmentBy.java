package com.propertyinsights.market.analytics;

import com.propertyinsights.market.data.Property;
import java.math.BigDecimal;
import java.util.Arrays;

/** How to split the market into segments, as accepted by {@code ?by=}. */
public enum SegmentBy {
    BEDROOMS("bedrooms"),
    BATHROOMS("bathrooms"),
    DECADE("decade"),
    SCHOOL_BAND("school_band"),
    DISTANCE_BAND("distance_band");

    /** A segment's display label and its position in a sorted list. */
    public record Segment(String label, double order) {}

    private final String key;

    SegmentBy(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    public static SegmentBy fromKey(String key) {
        return Arrays.stream(values())
                .filter(s -> s.key.equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("by must be one of bedrooms, bathrooms, decade, "
                        + "school_band, distance_band"));
    }

    public Segment of(Property p) {
        return switch (this) {
            case BEDROOMS -> new Segment(p.bedrooms() + " bed", p.bedrooms());
            case BATHROOMS -> new Segment(plain(p.bathrooms()) + " bath", p.bathrooms());
            case DECADE -> {
                int decade = p.yearBuilt() / 10 * 10;
                yield new Segment(decade + "s", decade);
            }
            case SCHOOL_BAND -> schoolBand(p.schoolRating());
            case DISTANCE_BAND -> distanceBand(p.distanceToCityCenter());
        };
    }

    // Java 21 pattern matching with guards. Primitive patterns are still a preview in 21, hence the boxing.
    private static Segment schoolBand(double rating) {
        return switch (Double.valueOf(rating)) {
            case Double r when r < 7 -> new Segment("Below 7", 0);
            case Double r when r < 8 -> new Segment("7 to 8", 1);
            case Double r when r < 9 -> new Segment("8 to 9", 2);
            default -> new Segment("9 and above", 3);
        };
    }

    private static Segment distanceBand(double miles) {
        return switch (Double.valueOf(miles)) {
            case Double d when d < 3 -> new Segment("Under 3 mi", 0);
            case Double d when d < 5 -> new Segment("3 to 5 mi", 1);
            case Double d when d < 7 -> new Segment("5 to 7 mi", 2);
            default -> new Segment("7 mi or more", 3);
        };
    }

    private static String plain(double value) {
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }
}
