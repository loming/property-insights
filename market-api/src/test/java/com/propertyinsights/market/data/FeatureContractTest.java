package com.propertyinsights.market.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.propertyinsights.market.whatif.HouseFeatures;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Year;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Contract: this service must accept and reject exactly what ml-api does, or users see the model's errors
 * instead of field errors. Reads ml-api's feature list from the monorepo checkout.
 */
class FeatureContractTest {

    static final Path ML_API_FEATURES = Path.of("../ml-api/src/ml_api/features.py");
    static final Pattern FEATURE = Pattern.compile(
            "Feature\\(\"([a-z_]+)\", \"([^\"]+)\", \"([^\"]+)\", (True|False), ([0-9_]+), ([0-9_]+|CURRENT_YEAR)"
                    + "(?:, ([0-9.]+))?\\)");
    static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();
    static final HouseFeatures HOME = new HouseFeatures(1550, 3, 2.0, 1997, 6800.0, 4.1, 7.6);

    record PythonFeature(String key, String label, String unit, boolean integer, double min, double max, Double step) {}

    @Test
    void featureLimitsMatchMlApi() throws IOException {
        assumeTrue(Files.exists(ML_API_FEATURES), "needs the monorepo checkout");
        List<PythonFeature> python = new ArrayList<>();
        Matcher m = FEATURE.matcher(Files.readString(ML_API_FEATURES));
        while (m.find()) {
            python.add(new PythonFeature(m.group(1), m.group(2), m.group(3), m.group(4).equals("True"),
                    number(m.group(5)), m.group(6).equals("CURRENT_YEAR") ? Year.now().getValue() : number(m.group(6)),
                    m.group(7) == null ? null : Double.valueOf(m.group(7))));
        }
        List<PythonFeature> mirrored = Arrays.stream(Feature.values())
                .map(f -> new PythonFeature(f.key(), f.label(), f.unit(), f.integer(), f.hardMin(), f.hardMax(), f.step()))
                .toList();
        assertThat(python).hasSize(7);
        assertThat(mirrored).isEqualTo(python);
    }

    /** HouseFeatures' annotations must enforce the same limits as the Feature enum. */
    @Test
    void houseFeaturesValidatesTheSameLimits() {
        for (Feature f : Feature.values()) {
            assertThat(VALIDATOR.validate(HOME.with(f, f.hardMin()))).as(f + " at its minimum").isEmpty();
            assertThat(VALIDATOR.validate(HOME.with(f, f.hardMax()))).as(f + " at its maximum").isEmpty();
            double step = f.step() == null ? 0.01 : f.step();
            assertThat(VALIDATOR.validate(HOME.with(f, f.hardMax() + step))).as(f + " above its maximum").isNotEmpty();
            if (f.hardMin() > 0) {
                assertThat(VALIDATOR.validate(HOME.with(f, f.hardMin() - step))).as(f + " below its minimum").isNotEmpty();
            }
        }
    }

    private static double number(String text) {
        return Double.parseDouble(text.replace("_", ""));
    }
}
