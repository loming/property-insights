package com.propertyinsights.market.data;

import com.propertyinsights.market.analytics.MarketFilter;
import com.propertyinsights.market.config.MarketProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

/** The dataset, loaded once at startup into an immutable list. It never changes while the app runs. */
@Repository
public class PropertyRepository {

    private static final Logger log = LoggerFactory.getLogger(PropertyRepository.class);

    private final List<Property> properties;

    public PropertyRepository(MarketProperties settings) {
        // getInputStream, not getFile: works for a mounted file and inside a jar alike (doc 02, D5).
        try (InputStream input = settings.data().getInputStream()) {
            this.properties = CsvPropertyLoader.load(input);
        } catch (IOException e) {
            throw new UncheckedIOException("Can't read the dataset at " + settings.data(), e);
        }
        log.info("Loaded {} properties from {}", properties.size(), settings.data());
    }

    public List<Property> all() {
        return properties;
    }

    public List<Property> matching(MarketFilter filter) {
        return properties.stream().filter(filter::matches).toList();
    }
}
