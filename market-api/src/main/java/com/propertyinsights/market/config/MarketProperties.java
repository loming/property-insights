package com.propertyinsights.market.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;
import org.springframework.validation.annotation.Validated;

/** Settings under {@code market.*}, validated at startup so a bad value fails fast. */
@ConfigurationProperties("market")
@Validated
public record MarketProperties(
        @NotNull Resource data,
        @NotBlank String mlApiUrl,
        @Min(0) @Max(5) int mlRetries,
        @NotNull Duration modelCacheTtl) {}
