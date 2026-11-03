package com.propertyinsights.market.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class StatsTest {

    @Test
    void quantilesInterpolateLikeNumpy() {
        double[] sorted = {1, 2, 3, 4};
        assertThat(Stats.quantile(sorted, 0.5)).isEqualTo(2.5);
        assertThat(Stats.quantile(sorted, 0.25)).isEqualTo(1.75);
        assertThat(Stats.quantile(sorted, 0.75)).isEqualTo(3.25);
        assertThat(Stats.quantile(new double[] {7}, 0.25)).isEqualTo(7);
        assertThat(Stats.median(new double[] {5, 1, 3})).isEqualTo(3);
    }

    @Test
    void pearson() {
        assertThat(Stats.pearson(new double[] {1, 2, 3}, new double[] {2, 4, 6})).isCloseTo(1.0, within(1e-12));
        assertThat(Stats.pearson(new double[] {1, 2, 3}, new double[] {6, 4, 2})).isCloseTo(-1.0, within(1e-12));
    }

    @Test
    void roundsHalfUp() {
        assertThat(Stats.round(253_333.3333, 2)).isEqualTo(253_333.33);
        assertThat(Stats.round(0.98765, 4)).isEqualTo(0.9877);
    }
}
