package com.propertyinsights.market.export;

import com.propertyinsights.market.analytics.MarketViews.PropertyRow;
import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Component;

/**
 * The filtered rows as CSV (RFC 4180). Every cell is a number written by Java's locale-independent
 * toString, so there's no locale-specific separator and no free text to guard against formula
 * injection (doc 02, D9); a text column would need that guard.
 */
@Component
public class CsvExporter {

    static final String[] HEADER = {
        "id", "square_footage", "bedrooms", "bathrooms", "year_built", "lot_size", "distance_to_city_center",
        "school_rating", "price", "price_per_sqft"
    };

    public byte[] export(List<PropertyRow> rows) {
        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.builder().setHeader(HEADER).get())) {
            for (PropertyRow r : rows) {
                printer.printRecord(r.id(), r.squareFootage(), r.bedrooms(), r.bathrooms(), r.yearBuilt(), r.lotSize(),
                        r.distanceToCityCenter(), r.schoolRating(), r.price(), r.pricePerSqft());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toString().getBytes(StandardCharsets.UTF_8);
    }
}
