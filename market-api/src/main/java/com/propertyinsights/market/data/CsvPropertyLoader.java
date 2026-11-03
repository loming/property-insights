package com.propertyinsights.market.data;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

/** Parses the housing CSV and fails fast, with the row number, on anything unexpected. */
public final class CsvPropertyLoader {

    static final List<String> COLUMNS = List.of(
            "id", "square_footage", "bedrooms", "bathrooms", "year_built", "lot_size",
            "distance_to_city_center", "school_rating", "price");

    private CsvPropertyLoader() {}

    public static List<Property> load(InputStream input) throws IOException {
        Reader reader = skipByteOrderMark(new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8)));
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).get();
        try (CSVParser parser = CSVParser.parse(reader, format)) {
            Set<String> header = parser.getHeaderMap().keySet();
            List<String> missing = COLUMNS.stream().filter(c -> !header.contains(c)).toList();
            if (!missing.isEmpty()) {
                throw new IllegalStateException("Dataset is missing columns " + missing);
            }
            List<Property> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                rows.add(toProperty(record));
            }
            if (rows.isEmpty()) {
                throw new IllegalStateException("Dataset has no rows");
            }
            return List.copyOf(rows);
        }
    }

    private static Property toProperty(CSVRecord record) {
        try {
            return new Property(
                    Integer.parseInt(record.get("id")),
                    Integer.parseInt(record.get("square_footage")),
                    Integer.parseInt(record.get("bedrooms")),
                    Double.parseDouble(record.get("bathrooms")),
                    Integer.parseInt(record.get("year_built")),
                    Integer.parseInt(record.get("lot_size")),
                    Double.parseDouble(record.get("distance_to_city_center")),
                    Double.parseDouble(record.get("school_rating")),
                    Integer.parseInt(record.get("price")));
        } catch (RuntimeException e) {
            throw new IllegalStateException("Dataset row " + (record.getRecordNumber() + 1) + " is invalid: " + e.getMessage(), e);
        }
    }

    /** The provided CSVs had a UTF-8 BOM; data/ copies don't, but the loader stays safe (doc 02, A7). */
    private static Reader skipByteOrderMark(BufferedReader reader) throws IOException {
        reader.mark(1);
        if (reader.read() != '﻿') {
            reader.reset();
        }
        return reader;
    }
}
