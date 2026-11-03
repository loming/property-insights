package com.propertyinsights.market.web;

import com.propertyinsights.market.analytics.MarketAnalytics;
import com.propertyinsights.market.analytics.MarketFilter;
import com.propertyinsights.market.analytics.SegmentBy;
import com.propertyinsights.market.export.CsvExporter;
import com.propertyinsights.market.export.PdfReportExporter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market/export")
@Tag(name = "export", description = "Downloads of the filtered view, generated server-side")
public class ExportController {

    private static final String SORT_PATTERN =
            "(id|price|price_per_sqft|square_footage|bedrooms|bathrooms|year_built|lot_size"
                    + "|distance_to_city_center|school_rating),(asc|desc)";

    private final MarketAnalytics analytics;
    private final CsvExporter csv;
    private final PdfReportExporter pdf;

    public ExportController(MarketAnalytics analytics, CsvExporter csv, PdfReportExporter pdf) {
        this.analytics = analytics;
        this.csv = csv;
        this.pdf = pdf;
    }

    @GetMapping("/csv")
    @Operation(summary = "The filtered properties as CSV")
    public ResponseEntity<byte[]> exportCsv(
            @ParameterObject @Valid MarketFilter filter,
            @RequestParam(defaultValue = "id,asc") @Pattern(regexp = SORT_PATTERN, message = "sort must be <field>,asc or <field>,desc") String sort) {
        byte[] body = csv.export(analytics.sortedRows(filter, sort));
        return download(body, new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8), "csv");
    }

    @GetMapping("/pdf")
    @Operation(summary = "A PDF report: summary, segments by bedrooms and the filtered properties")
    public ResponseEntity<byte[]> exportPdf(
            @ParameterObject @Valid MarketFilter filter,
            @RequestParam(defaultValue = "id,asc") @Pattern(regexp = SORT_PATTERN, message = "sort must be <field>,asc or <field>,desc") String sort) {
        byte[] body = pdf.export(describe(filter), analytics.summary(filter),
                analytics.segments(SegmentBy.BEDROOMS, filter).segments(), analytics.sortedRows(filter, sort));
        return download(body, MediaType.APPLICATION_PDF, "pdf");
    }

    private static ResponseEntity<byte[]> download(byte[] body, MediaType type, String extension) {
        String filename = "property-market-" + LocalDate.now(ZoneOffset.UTC) + "." + extension;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                // Downloads reflect the moment they were made; never cached (doc 02, D9).
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    /** The filters in words, for the report's header. */
    static String describe(MarketFilter f) {
        if (f.hasNoCriteria()) {
            return "none (the whole market)";
        }
        List<String> parts = new ArrayList<>();
        if (!f.bedrooms().isEmpty()) {
            parts.add("bedrooms " + f.bedrooms());
        }
        range(parts, "bathrooms", f.minBathrooms(), f.maxBathrooms());
        range(parts, "price", f.minPrice(), f.maxPrice());
        range(parts, "sq ft", f.minSqft(), f.maxSqft());
        range(parts, "year built", f.minYear() == null ? null : f.minYear().doubleValue(),
                f.maxYear() == null ? null : f.maxYear().doubleValue());
        range(parts, "school rating", f.minSchoolRating(), f.maxSchoolRating());
        range(parts, "miles to centre", f.minDistance(), f.maxDistance());
        return String.join("; ", parts);
    }

    private static void range(List<String> parts, String name, Double min, Double max) {
        if (min != null || max != null) {
            parts.add(name + " " + (min == null ? "any" : fmt(min)) + " to " + (max == null ? "any" : fmt(max)));
        }
    }

    private static String fmt(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }
}
