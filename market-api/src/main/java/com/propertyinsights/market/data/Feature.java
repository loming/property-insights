package com.propertyinsights.market.data;

import java.time.Year;
import java.util.Arrays;
import java.util.Optional;
import java.util.function.ToDoubleFunction;

/**
 * The model's input features and their hard limits, mirrored from ml-api's features.py so what-if input
 * is rejected here with a field error before any model call. FeatureContractTest fails if they drift.
 */
public enum Feature {
    SQUARE_FOOTAGE("square_footage", "Living area", "sq ft", true, 200, 20_000, 1, Property::squareFootage),
    BEDROOMS("bedrooms", "Bedrooms", "count", true, 0, 20, 1, Property::bedrooms),
    BATHROOMS("bathrooms", "Bathrooms", "count", false, 0, 20, 0.5, Property::bathrooms),
    YEAR_BUILT("year_built", "Year built", "year", true, 1800, Year.now().getValue(), 1, Property::yearBuilt),
    LOT_SIZE("lot_size", "Lot size", "sq ft", false, 0, 1_000_000, null, Property::lotSize),
    DISTANCE_TO_CITY_CENTER(
            "distance_to_city_center", "Distance to city centre", "miles", false, 0, 200, null,
            Property::distanceToCityCenter),
    SCHOOL_RATING("school_rating", "School rating", "0-10 scale", false, 0, 10, null, Property::schoolRating);

    private final String key;
    private final String label;
    private final String unit;
    private final boolean integer;
    private final double hardMin;
    private final double hardMax;
    private final Double step;
    private final ToDoubleFunction<Property> getter;

    Feature(String key, String label, String unit, boolean integer, double hardMin, double hardMax, Number step,
            ToDoubleFunction<Property> getter) {
        this.key = key;
        this.label = label;
        this.unit = unit;
        this.integer = integer;
        this.hardMin = hardMin;
        this.hardMax = hardMax;
        this.step = step == null ? null : step.doubleValue();
        this.getter = getter;
    }

    /** The snake_case name used in JSON and query parameters. */
    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    public String unit() {
        return unit;
    }

    public boolean integer() {
        return integer;
    }

    public double hardMin() {
        return hardMin;
    }

    public double hardMax() {
        return hardMax;
    }

    public Double step() {
        return step;
    }

    public double of(Property property) {
        return getter.applyAsDouble(property);
    }

    /** Rounds a value to one the model accepts: whole numbers, or half steps for bathrooms. */
    public double toValid(double value) {
        if (integer) {
            return Math.round(value);
        }
        return step == null ? value : Math.round(value / step) * step;
    }

    public static Optional<Feature> fromKey(String key) {
        return Arrays.stream(values()).filter(f -> f.key.equals(key)).findFirst();
    }
}
