package com.propertyinsights.market.analytics;

import com.propertyinsights.market.analytics.MarketViews.Bin;
import com.propertyinsights.market.analytics.MarketViews.Correlation;
import com.propertyinsights.market.analytics.MarketViews.FilterOptions;
import com.propertyinsights.market.analytics.MarketViews.Histogram;
import com.propertyinsights.market.analytics.MarketViews.PriceStats;
import com.propertyinsights.market.analytics.MarketViews.PropertyPage;
import com.propertyinsights.market.analytics.MarketViews.PropertyRow;
import com.propertyinsights.market.analytics.MarketViews.Range;
import com.propertyinsights.market.analytics.MarketViews.SegmentMedian;
import com.propertyinsights.market.analytics.MarketViews.SegmentMedians;
import com.propertyinsights.market.analytics.MarketViews.SegmentRow;
import com.propertyinsights.market.analytics.MarketViews.Segments;
import com.propertyinsights.market.analytics.MarketViews.Summary;
import com.propertyinsights.market.data.Feature;
import com.propertyinsights.market.data.Property;
import com.propertyinsights.market.data.PropertyRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Aggregate statistics over the dataset. The data never changes while the app runs, so results are cached
 * with no expiry, keyed by the immutable filter records. The real saving is small (50 rows); the ML calls
 * in what-if are where caching pays.
 */
@Service
public class MarketAnalytics {

    public static final List<String> SORT_FIELDS = List.of(
            "id", "price", "price_per_sqft", "square_footage", "bedrooms", "bathrooms", "year_built", "lot_size",
            "distance_to_city_center", "school_rating");

    private final PropertyRepository repository;

    public MarketAnalytics(PropertyRepository repository) {
        this.repository = repository;
    }

    @Cacheable("summary")
    public Summary summary(MarketFilter filter) {
        List<Property> rows = repository.matching(filter);
        if (rows.isEmpty()) {
            return new Summary(0, null, null, null, null);
        }
        double[] prices = values(rows, Property::price);
        double[] sorted = Stats.sorted(prices);
        PriceStats price = new PriceStats(
                Stats.round(Stats.mean(prices), 2),
                Stats.round(Stats.quantile(sorted, 0.5), 2),
                sorted[0],
                sorted[sorted.length - 1],
                Stats.round(Stats.quantile(sorted, 0.25), 2),
                Stats.round(Stats.quantile(sorted, 0.75), 2));
        return new Summary(
                rows.size(),
                price,
                Stats.round(Stats.mean(values(rows, Property::pricePerSqft)), 2),
                Stats.round(Stats.mean(values(rows, Property::squareFootage)), 2),
                Stats.round(Stats.mean(values(rows, Property::schoolRating)), 2));
    }

    @Cacheable("segments")
    public Segments segments(SegmentBy by, MarketFilter filter) {
        List<SegmentRow> rows = group(by, repository.matching(filter)).entrySet().stream()
                .map(e -> {
                    double[] prices = values(e.getValue(), Property::price);
                    return new SegmentRow(
                            e.getKey().label(),
                            e.getValue().size(),
                            Stats.round(Stats.mean(prices), 2),
                            Stats.round(Stats.median(prices), 2),
                            Stats.round(Stats.mean(values(e.getValue(), Property::pricePerSqft)), 2));
                })
                .toList();
        return new Segments(by.key(), rows);
    }

    @Cacheable("segmentMedians")
    public SegmentMedians segmentMedians(SegmentBy by, MarketFilter filter) {
        List<SegmentMedian> rows = group(by, repository.matching(filter)).entrySet().stream()
                .map(e -> new SegmentMedian(
                        e.getKey().label(),
                        e.getValue().size(),
                        Stats.round(Stats.median(values(e.getValue(), Property::price)), 2),
                        medianHome(e.getValue())))
                .toList();
        return new SegmentMedians(by.key(), rows);
    }

    @Cacheable("distribution")
    public Histogram distribution(DistributionMetric metric, int binCount, MarketFilter filter) {
        double[] values = values(repository.matching(filter), metric::of);
        if (values.length == 0) {
            return new Histogram(metric.key(), 0, List.of());
        }
        double min = Arrays.stream(values).min().orElseThrow();
        double max = Arrays.stream(values).max().orElseThrow();
        int bins = min == max ? 1 : binCount;
        double width = (max - min) / bins;
        int[] counts = new int[bins];
        for (double value : values) {
            // The top edge belongs to the last bin.
            counts[Math.min(bins - 1, width == 0 ? 0 : (int) ((value - min) / width))]++;
        }
        List<Bin> result = new ArrayList<>();
        for (int i = 0; i < bins; i++) {
            double upper = i == bins - 1 ? max : min + width * (i + 1);
            result.add(new Bin(Stats.round(min + width * i, 2), Stats.round(upper, 2), counts[i]));
        }
        return new Histogram(metric.key(), values.length, result);
    }

    @Cacheable("correlations")
    public List<Correlation> correlations() {
        List<Property> all = repository.all();
        double[] prices = values(all, Property::price);
        return Arrays.stream(Feature.values())
                .map(f -> new Correlation(f.key(), Stats.round(Stats.pearson(values(all, f::of), prices), 4)))
                .sorted(Comparator.comparingDouble((Correlation c) -> Math.abs(c.r())).reversed())
                .toList();
    }

    @Cacheable("properties")
    public PropertyPage properties(MarketFilter filter, String sort, int page, int size) {
        List<PropertyRow> rows = sortedRows(filter, sort);
        int from = Math.min(page * size, rows.size());
        int to = Math.min(from + size, rows.size());
        return new PropertyPage(rows.subList(from, to), rows.size(), page, size, sort);
    }

    /** All matching rows in the given order; used by the exports too. */
    public List<PropertyRow> sortedRows(MarketFilter filter, String sort) {
        String[] parts = sort.split(",");
        Comparator<PropertyRow> order = Comparator.comparingDouble(sortKey(parts[0]));
        if (parts.length > 1 && parts[1].equals("desc")) {
            order = order.reversed();
        }
        return repository.matching(filter).stream()
                .map(MarketAnalytics::row)
                .sorted(order.thenComparingInt(PropertyRow::id))
                .toList();
    }

    @Cacheable("filterOptions")
    public FilterOptions filterOptions() {
        List<Property> all = repository.all();
        Map<String, Range> ranges = new LinkedHashMap<>();
        for (Feature f : Feature.values()) {
            ranges.put(f.key(), range(values(all, f::of)));
        }
        ranges.put("price", range(values(all, Property::price)));
        ranges.put("price_per_sqft", range(values(all, Property::pricePerSqft)));
        return new FilterOptions(
                ranges,
                all.stream().map(Property::bedrooms).distinct().sorted().toList(),
                all.stream().map(Property::bathrooms).distinct().sorted().toList(),
                Arrays.stream(SegmentBy.values()).map(SegmentBy::key).toList(),
                SORT_FIELDS);
    }

    public static PropertyRow row(Property p) {
        return new PropertyRow(
                p.id(), p.squareFootage(), p.bedrooms(), p.bathrooms(), p.yearBuilt(), p.lotSize(),
                p.distanceToCityCenter(), p.schoolRating(), p.price(), Stats.round(p.pricePerSqft(), 2));
    }

    private static ToDoubleFunction<PropertyRow> sortKey(String field) {
        return switch (field) {
            case "price" -> PropertyRow::price;
            case "price_per_sqft" -> PropertyRow::pricePerSqft;
            case "square_footage" -> PropertyRow::squareFootage;
            case "bedrooms" -> PropertyRow::bedrooms;
            case "bathrooms" -> PropertyRow::bathrooms;
            case "year_built" -> PropertyRow::yearBuilt;
            case "lot_size" -> PropertyRow::lotSize;
            case "distance_to_city_center" -> PropertyRow::distanceToCityCenter;
            case "school_rating" -> PropertyRow::schoolRating;
            default -> PropertyRow::id;
        };
    }

    private static Map<SegmentBy.Segment, List<Property>> group(SegmentBy by, List<Property> rows) {
        return rows.stream().collect(Collectors.groupingBy(
                by::of,
                () -> new TreeMap<>(Comparator.comparingDouble(SegmentBy.Segment::order)),
                Collectors.toList()));
    }

    private static Map<String, Double> medianHome(List<Property> rows) {
        Map<String, Double> home = new LinkedHashMap<>();
        for (Feature f : Feature.values()) {
            // A median of 3.5 bedrooms isn't a home the model can price: round to valid values.
            home.put(f.key(), f.toValid(Stats.median(values(rows, f::of))));
        }
        return home;
    }

    private static Range range(double[] values) {
        return new Range(
                Stats.round(Arrays.stream(values).min().orElse(Double.NaN), 2),
                Stats.round(Arrays.stream(values).max().orElse(Double.NaN), 2));
    }

    private static double[] values(List<Property> rows, ToDoubleFunction<Property> getter) {
        return rows.stream().mapToDouble(getter).toArray();
    }
}
