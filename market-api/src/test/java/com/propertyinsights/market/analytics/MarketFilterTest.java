package com.propertyinsights.market.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.market.data.Property;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MarketFilterTest {

    static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();
    static final Property HOME = new Property(7, 1800, 3, 2.0, 2001, 7000, 5.0, 8.0, 280_000);

    static MarketFilter bedrooms(Integer... values) {
        return new MarketFilter(Arrays.asList(values), null, null, null, null, null, null, null, null, null, null, null, null);
    }

    static MarketFilter price(Double min, Double max) {
        return new MarketFilter(null, null, null, min, max, null, null, null, null, null, null, null, null);
    }

    @Test
    void bedroomOrderAndDuplicatesDontChangeTheCacheKey() {
        assertThat(bedrooms(3, 2, 3)).isEqualTo(bedrooms(2, 3)).hasSameHashCodeAs(bedrooms(2, 3));
        assertThat(bedrooms(3, 2).bedrooms()).containsExactly(2, 3);
    }

    @Test
    void noCriteriaMatchesEverything() {
        assertThat(MarketFilter.NONE.hasNoCriteria()).isTrue();
        assertThat(new MarketFilter(null, null, null, null, null, null, null, null, null, null, null, null, null))
                .isEqualTo(MarketFilter.NONE);
        assertThat(MarketFilter.NONE.matches(HOME)).isTrue();
    }

    @Test
    void boundsAreInclusive() {
        assertThat(price(280_000.0, 280_000.0).matches(HOME)).isTrue();
        assertThat(price(280_001.0, null).matches(HOME)).isFalse();
        assertThat(bedrooms(2, 4).matches(HOME)).isFalse();
        assertThat(bedrooms(3).matches(HOME)).isTrue();
    }

    @Test
    void validation() {
        assertThat(VALIDATOR.validate(price(100.0, 200.0))).isEmpty();
        assertThat(messages(VALIDATOR.validate(price(300.0, 200.0)))).containsExactly("each min_* must not exceed the matching max_*");
        assertThat(VALIDATOR.validate(price(-1.0, null))).hasSize(1);
        assertThat(VALIDATOR.validate(bedrooms(21))).hasSize(1);
    }

    private static List<String> messages(Set<ConstraintViolation<MarketFilter>> violations) {
        return violations.stream().map(ConstraintViolation::getMessage).toList();
    }
}
