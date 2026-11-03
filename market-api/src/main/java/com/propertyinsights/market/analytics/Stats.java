package com.propertyinsights.market.analytics;

import java.util.Arrays;

/** Small statistics helpers. Doubles throughout; values are rounded only at the API boundary (doc 02, D10). */
final class Stats {

    private Stats() {}

    static double mean(double[] values) {
        return Arrays.stream(values).average().orElse(Double.NaN);
    }

    static double[] sorted(double[] values) {
        double[] copy = values.clone();
        Arrays.sort(copy);
        return copy;
    }

    /** Quantile by linear interpolation between closest ranks: numpy's and pandas' default. */
    static double quantile(double[] sortedValues, double q) {
        if (sortedValues.length == 0) {
            return Double.NaN;
        }
        double position = (sortedValues.length - 1) * q;
        int below = (int) Math.floor(position);
        int above = (int) Math.ceil(position);
        return sortedValues[below] + (position - below) * (sortedValues[above] - sortedValues[below]);
    }

    static double median(double[] values) {
        return quantile(sorted(values), 0.5);
    }

    /** Pearson correlation coefficient. */
    static double pearson(double[] x, double[] y) {
        double mx = mean(x);
        double my = mean(y);
        double covariance = 0;
        double vx = 0;
        double vy = 0;
        for (int i = 0; i < x.length; i++) {
            covariance += (x[i] - mx) * (y[i] - my);
            vx += (x[i] - mx) * (x[i] - mx);
            vy += (y[i] - my) * (y[i] - my);
        }
        return covariance / Math.sqrt(vx * vy);
    }

    static double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }
}
