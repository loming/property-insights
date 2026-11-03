package com.propertyinsights.market.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

@Configuration
public class HttpCachingConfig {

    /**
     * ETags on the market GETs, so the portal's revalidations cost a 304. The filter buffers whole responses,
     * so the downloads are left out (doc 02, D9).
     */
    @Bean
    FilterRegistrationBean<ShallowEtagHeaderFilter> etags() {
        ShallowEtagHeaderFilter filter = new ShallowEtagHeaderFilter() {
            @Override
            protected boolean shouldNotFilter(HttpServletRequest request) {
                return request.getRequestURI().contains("/api/v1/market/export/");
            }
        };
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration = new FilterRegistrationBean<>(filter);
        registration.addUrlPatterns("/api/v1/market/*");
        return registration;
    }
}
