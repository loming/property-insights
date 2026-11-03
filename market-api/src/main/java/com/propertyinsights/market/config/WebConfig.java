package com.propertyinsights.market.config;

import com.propertyinsights.market.analytics.DistributionMetric;
import com.propertyinsights.market.analytics.SegmentBy;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /** Query values are snake_case keys (by=school_band), not Java constant names. */
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(String.class, SegmentBy.class, SegmentBy::fromKey);
        registry.addConverter(String.class, DistributionMetric.class, DistributionMetric::fromKey);
    }
}
