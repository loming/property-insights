package com.propertyinsights.market.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.autoconfigure.cache.CacheManagerCustomizer;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Every cache registered at startup with its own policy and statistics on. Boot's single
 * spring.cache.caffeine.spec can't give the aggregates no expiry and the model calls a TTL, and caches
 * created lazily get no metrics (doc 02, D4).
 */
@Configuration
public class CacheConfig {

    /** The dataset is immutable while the app runs, so these never expire; maximumSize bounds memory. */
    public static final List<String> AGGREGATES = List.of(
            "summary", "segments", "segmentMedians", "distribution", "properties", "correlations", "filterOptions");

    /** Results that depend on ml-api: a TTL, and keys include the model version. */
    public static final List<String> MODEL_RESULTS = List.of("whatIf", "sensitivity", "modelInfo");

    @Bean
    CacheManagerCustomizer<CaffeineCacheManager> registerCaches(MarketProperties settings) {
        return manager -> {
            manager.setAllowNullValues(false);
            for (String name : AGGREGATES) {
                manager.registerCustomCache(name, Caffeine.newBuilder().maximumSize(500).recordStats().build());
            }
            Duration ttl = settings.modelCacheTtl();
            for (String name : MODEL_RESULTS) {
                manager.registerCustomCache(
                        name, Caffeine.newBuilder().maximumSize(1_000).expireAfterWrite(ttl).recordStats().build());
            }
        };
    }
}
