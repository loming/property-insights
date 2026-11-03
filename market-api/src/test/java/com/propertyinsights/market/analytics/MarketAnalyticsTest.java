package com.propertyinsights.market.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.market.analytics.MarketViews.Bin;
import com.propertyinsights.market.analytics.MarketViews.SegmentMedian;
import com.propertyinsights.market.analytics.MarketViews.SegmentRow;
import com.propertyinsights.market.analytics.MarketViews.Summary;
import com.propertyinsights.market.config.MarketProperties;
import com.propertyinsights.market.data.PropertyRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

/** Against a 6-row fixture whose statistics were worked out by hand. */
class MarketAnalyticsTest {

    static final String FIXTURE = """
            id,square_footage,bedrooms,bathrooms,year_built,lot_size,distance_to_city_center,school_rating,price
            1,1000,2,1,1980,4000,2.5,6.8,150000
            2,1500,3,2,1995,6000,4.0,7.5,240000
            3,1600,3,2,1998,6500,4.5,7.9,250000
            4,2000,4,2.5,2005,8000,6.0,8.6,320000
            5,2200,4,3,2010,9000,7.5,9.1,380000
            6,1200,2,1.5,1985,5000,3.0,7.0,180000
            """;

    final MarketAnalytics analytics = new MarketAnalytics(new PropertyRepository(new MarketProperties(
            new ByteArrayResource(FIXTURE.getBytes(StandardCharsets.UTF_8)), "http://unused", 0, Duration.ofMinutes(1))));

    static MarketFilter bedrooms(Integer... values) {
        return new MarketFilter(List.of(values), null, null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void summary() {
        Summary summary = analytics.summary(MarketFilter.NONE);
        assertThat(summary.count()).isEqualTo(6);
        // Sorted prices: 150k 180k 240k 250k 320k 380k.
        assertThat(summary.price().mean()).isEqualTo(253_333.33);
        assertThat(summary.price().median()).isEqualTo(245_000);
        assertThat(summary.price().q1()).isEqualTo(195_000); // 180k + 0.25 * (240k - 180k)
        assertThat(summary.price().q3()).isEqualTo(302_500); // 250k + 0.75 * (320k - 250k)
        assertThat(summary.price().min()).isEqualTo(150_000);
        assertThat(summary.price().max()).isEqualTo(380_000);
        assertThat(analytics.summary(bedrooms(3)).price().mean()).isEqualTo(245_000);
    }

    @Test
    void noMatchesGiveAnEmptySummary() {
        Summary summary = analytics.summary(bedrooms(7));
        assertThat(summary.count()).isZero();
        assertThat(summary.price()).isNull();
    }

    @Test
    void segmentsAreBucketedAndOrdered() {
        assertThat(analytics.segments(SegmentBy.BEDROOMS, MarketFilter.NONE).segments())
                .extracting(SegmentRow::segment, SegmentRow::count, SegmentRow::meanPrice)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("2 bed", 2, 165_000.0),
                        org.assertj.core.groups.Tuple.tuple("3 bed", 2, 245_000.0),
                        org.assertj.core.groups.Tuple.tuple("4 bed", 2, 350_000.0));
        assertThat(labels(SegmentBy.DECADE)).containsExactly("1980s", "1990s", "2000s", "2010s");
        assertThat(labels(SegmentBy.SCHOOL_BAND)).containsExactly("Below 7", "7 to 8", "8 to 9", "9 and above");
        assertThat(counts(SegmentBy.SCHOOL_BAND)).containsExactly(1, 3, 1, 1);
        // 3.0 miles falls in "3 to 5": the lower bound is inclusive.
        assertThat(counts(SegmentBy.DISTANCE_BAND)).containsExactly(1, 3, 1, 1);
        assertThat(labels(SegmentBy.BATHROOMS)).containsExactly("1 bath", "1.5 bath", "2 bath", "2.5 bath", "3 bath");
    }

    @Test
    void segmentMediansAreHomesTheModelCanPrice() {
        SegmentMedian twoBed = analytics.segmentMedians(SegmentBy.BEDROOMS, MarketFilter.NONE).segments().getFirst();
        Map<String, Double> home = twoBed.features();
        assertThat(home.get("square_footage")).isEqualTo(1100);
        assertThat(home.get("bathrooms")).isEqualTo(1.5); // median 1.25, rounded to a half step
        assertThat(home.get("year_built")).isEqualTo(1983); // median 1982.5, rounded to a whole year
        assertThat(home.get("distance_to_city_center")).isEqualTo(2.75);
        assertThat(home).hasSize(7);
        assertThat(twoBed.medianPrice()).isEqualTo(165_000);
    }

    @Test
    void histogramBinsCoverTheRangeAndKeepTheTopEdge() {
        List<Bin> bins = analytics.distribution(DistributionMetric.PRICE, 2, MarketFilter.NONE).bins();
        assertThat(bins).containsExactly(new Bin(150_000, 265_000, 4), new Bin(265_000, 380_000, 2));
        assertThat(analytics.distribution(DistributionMetric.PRICE, 4, bedrooms(3)).bins()).hasSize(4);
        assertThat(analytics.distribution(DistributionMetric.PRICE, 4, bedrooms(7)).bins()).isEmpty();
    }

    @Test
    void propertiesSortAndPage() {
        var page = analytics.properties(MarketFilter.NONE, "price,desc", 1, 2);
        assertThat(page.total()).isEqualTo(6);
        assertThat(page.items()).extracting(MarketViews.PropertyRow::price).containsExactly(250_000, 240_000);
        assertThat(analytics.properties(MarketFilter.NONE, "id,asc", 5, 10).items()).isEmpty();
    }

    private List<String> labels(SegmentBy by) {
        return analytics.segments(by, MarketFilter.NONE).segments().stream().map(SegmentRow::segment).toList();
    }

    private List<Integer> counts(SegmentBy by) {
        return analytics.segments(by, MarketFilter.NONE).segments().stream().map(SegmentRow::count).toList();
    }
}
