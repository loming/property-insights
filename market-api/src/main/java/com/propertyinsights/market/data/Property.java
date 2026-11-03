package com.propertyinsights.market.data;

/** One row of the housing dataset. Immutable; field names serialise as snake_case. */
public record Property(
        int id,
        int squareFootage,
        int bedrooms,
        double bathrooms,
        int yearBuilt,
        int lotSize,
        double distanceToCityCenter,
        double schoolRating,
        int price) {

    public double pricePerSqft() {
        return (double) price / squareFootage;
    }
}
