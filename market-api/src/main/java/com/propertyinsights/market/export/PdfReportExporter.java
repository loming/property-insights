package com.propertyinsights.market.export;

import com.propertyinsights.market.analytics.MarketViews.PropertyRow;
import com.propertyinsights.market.analytics.MarketViews.SegmentRow;
import com.propertyinsights.market.analytics.MarketViews.Summary;
import java.io.ByteArrayOutputStream;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.openpdf.text.Document;
import org.openpdf.text.Element;
import org.openpdf.text.Font;
import org.openpdf.text.FontFactory;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import org.springframework.stereotype.Component;

/**
 * A one-file market report: summary, segments by bedrooms and the filtered rows. OpenPDF 3 (LGPL/MPL,
 * packages org.openpdf.*) with the standard PDF fonts, so the slim image needs no system fonts (doc 02, D6).
 */
@Component
public class PdfReportExporter {

    private static final Font TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
    private static final Font HEADING = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
    private static final Font TEXT = FontFactory.getFont(FontFactory.HELVETICA, 9);
    private static final Font CELL_HEADER = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
    private static final Font CELL = FontFactory.getFont(FontFactory.HELVETICA, 8);

    public byte[] export(String filters, Summary summary, List<SegmentRow> segments, List<PropertyRow> rows) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4.rotate(), 36, 36, 36, 36);
        PdfWriter.getInstance(document, out);
        document.open();
        document.add(new Paragraph("Property market report", TITLE));
        document.add(new Paragraph("Generated " + OffsetDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'")) + ". Filters: " + filters + ".", TEXT));

        document.add(heading("Summary"));
        PdfPTable summaryTable = table(new String[] {"Homes", "Mean price", "Median price", "Min", "Max", "Mean $/sq ft"});
        if (summary.count() > 0) {
            cells(summaryTable, String.valueOf(summary.count()), money(summary.price().mean()),
                    money(summary.price().median()), money(summary.price().min()), money(summary.price().max()),
                    money(summary.meanPricePerSqft()));
        } else {
            cells(summaryTable, "0", "-", "-", "-", "-", "-");
        }
        document.add(summaryTable);

        document.add(heading("By bedrooms"));
        PdfPTable segmentTable = table(new String[] {"Segment", "Homes", "Mean price", "Median price", "Mean $/sq ft"});
        for (SegmentRow s : segments) {
            cells(segmentTable, s.segment(), String.valueOf(s.count()), money(s.meanPrice()), money(s.medianPrice()),
                    money(s.meanPricePerSqft()));
        }
        document.add(segmentTable);

        document.add(heading("Properties (" + rows.size() + ")"));
        PdfPTable rowTable = table(new String[] {
            "ID", "Sq ft", "Beds", "Baths", "Built", "Lot sq ft", "Miles", "School", "Price", "$/sq ft"
        });
        for (PropertyRow r : rows) {
            cells(rowTable, String.valueOf(r.id()), String.valueOf(r.squareFootage()), String.valueOf(r.bedrooms()),
                    number(r.bathrooms()), String.valueOf(r.yearBuilt()), String.valueOf(r.lotSize()),
                    number(r.distanceToCityCenter()), number(r.schoolRating()), money(r.price()),
                    money(r.pricePerSqft()));
        }
        document.add(rowTable);
        document.close();
        return out.toByteArray();
    }

    private static Paragraph heading(String text) {
        Paragraph heading = new Paragraph(text, HEADING);
        heading.setSpacingBefore(12);
        heading.setSpacingAfter(4);
        return heading;
    }

    private static PdfPTable table(String[] headers) {
        PdfPTable table = new PdfPTable(headers.length);
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, CELL_HEADER));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            table.addCell(cell);
        }
        return table;
    }

    private static void cells(PdfPTable table, String... values) {
        for (String value : values) {
            PdfPCell cell = new PdfPCell(new Phrase(value, CELL));
            cell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            table.addCell(cell);
        }
    }

    private static String money(double value) {
        return new DecimalFormat("$#,##0", DecimalFormatSymbols.getInstance(Locale.US)).format(value);
    }

    private static String number(double value) {
        return new DecimalFormat("0.##", DecimalFormatSymbols.getInstance(Locale.US)).format(value);
    }
}
