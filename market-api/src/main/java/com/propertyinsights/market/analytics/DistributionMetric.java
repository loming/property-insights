package com.propertyinsights.market.analytics;

import com.propertyinsights.market.data.Property;
import java.util.Arrays;
import java.util.function.ToDoubleFunction;

/** What a histogram counts, as accepted by {@code ?metric=}. */
public enum DistributionMetric {
    PRICE("price", p -> p.price()),
    PRICE_PER_SQFT("price_per_sqft", Property::pricePerSqft);

    private final String key;
    private final ToDoubleFunction<Property> getter;

    DistributionMetric(String key, ToDoubleFunction<Property> getter) {
        this.key = key;
        this.getter = getter;
    }

    public String key() {
        return key;
    }

    public double of(Property property) {
        return getter.applyAsDouble(property);
    }

    public static DistributionMetric fromKey(String key) {
        return Arrays.stream(values())
                .filter(m -> m.key.equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("metric must be price or price_per_sqft"));
    }
}
