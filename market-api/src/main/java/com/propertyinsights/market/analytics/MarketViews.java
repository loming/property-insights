package com.propertyinsights.market.analytics;

import java.util.List;
import java.util.Map;

/** Response shapes of the analytics endpoints. Record components serialise as snake_case. */
public final class MarketViews {

    private MarketViews() {}

    public record PriceStats(double mean, double median, double min, double max, double q1, double q3) {}

    /** {@code price} and the means are null when no property matches the filters. */
    public record Summary(
            int count,
            PriceStats price,
            Double meanPricePerSqft,
            Double meanSquareFootage,
            Double meanSchoolRating) {}

    public record SegmentRow(String segment, int count, double meanPrice, double medianPrice, double meanPricePerSqft) {}

    public record Segments(String by, List<SegmentRow> segments) {}

    /** A segment's median home, rounded to values the model accepts: the what-if baselines. */
    public record SegmentMedian(String segment, int count, double medianPrice, Map<String, Double> features) {}

    public record SegmentMedians(String by, List<SegmentMedian> segments) {}

    public record Bin(double lower, double upper, int count) {}

    public record Histogram(String metric, int count, List<Bin> bins) {}

    public record Correlation(String feature, double r) {}

    public record PropertyRow(
            int id,
            int squareFootage,
            int bedrooms,
            double bathrooms,
            int yearBuilt,
            int lotSize,
            double distanceToCityCenter,
            double schoolRating,
            int price,
            double pricePerSqft) {}

    public record PropertyPage(List<PropertyRow> items, int total, int page, int size, String sort) {}

    public record Range(double min, double max) {}

    public record FilterOptions(
            Map<String, Range> ranges,
            List<Integer> bedrooms,
            List<Double> bathrooms,
            List<String> segmentBy,
            List<String> sortFields) {}
}
