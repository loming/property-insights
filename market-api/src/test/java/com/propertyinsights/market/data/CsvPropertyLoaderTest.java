package com.propertyinsights.market.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class CsvPropertyLoaderTest {

    static final Path DATASET = Path.of("../data/house_prices.csv");

    @Test
    void loadsTheProvidedDataset() throws IOException {
        try (InputStream input = Files.newInputStream(DATASET)) {
            List<Property> rows = CsvPropertyLoader.load(input);
            assertThat(rows).hasSize(50);
            assertThat(rows.getFirst().id()).isEqualTo(1);
            assertThat(rows).extracting(Property::bedrooms).containsOnly(2, 3, 4);
            assertThat(rows.stream().mapToInt(Property::price).average().orElseThrow()).isEqualTo(264_600.0);
        }
    }

    @Test
    void skipsAByteOrderMark() throws IOException {
        String csv = "﻿" + String.join(",", CsvPropertyLoader.COLUMNS) + "\r\n1,1500,3,2,1990,6000,4.5,7.5,250000\r\n";
        List<Property> rows = CsvPropertyLoader.load(stream(csv));
        assertThat(rows).containsExactly(new Property(1, 1500, 3, 2.0, 1990, 6000, 4.5, 7.5, 250_000));
    }

    @Test
    void failsFastOnAMissingColumn() {
        String csv = "id,square_footage\n1,1500\n";
        assertThatThrownBy(() -> CsvPropertyLoader.load(stream(csv)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("missing columns")
                .hasMessageContaining("price");
    }

    @Test
    void failsFastOnABadNumberWithTheRow() {
        String csv = String.join(",", CsvPropertyLoader.COLUMNS) + "\n1,1500,3,2,1990,6000,4.5,7.5,250000\n2,big,3,2,1990,6000,4.5,7.5,1\n";
        assertThatThrownBy(() -> CsvPropertyLoader.load(stream(csv)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("row 3");
    }

    private static InputStream stream(String csv) {
        return new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
    }
}
