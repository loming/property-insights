package com.propertyinsights.market.whatif;

import com.propertyinsights.market.data.Feature;
import com.propertyinsights.market.whatif.MlClient.BatchPrediction;
import com.propertyinsights.market.whatif.MlClient.Prediction;
import com.propertyinsights.market.whatif.WhatIfViews.Point;
import com.propertyinsights.market.whatif.WhatIfViews.SensitivityRequest;
import com.propertyinsights.market.whatif.WhatIfViews.SensitivityResult;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfRequest;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

/**
 * The cached model calls, in their own bean so @Cacheable isn't bypassed by self-invocation (doc 02, D4).
 * Keys include the model version, so a retrained model never serves old predictions. Failures throw,
 * and Spring's cache never stores a thrown call.
 */
@Component
public class ModelCalls {

    private final MlClient ml;

    public ModelCalls(MlClient ml) {
        this.ml = ml;
    }

    @Cacheable("modelInfo")
    public Map<String, Object> modelInfo() {
        return ml.modelInfo();
    }

    @Cacheable(cacheNames = "whatIf", key = "{#modelVersion, #request}")
    public WhatIfResult whatIf(WhatIfRequest request, String modelVersion) {
        HouseFeatures scenario = request.baseline().apply(request.changes());
        BatchPrediction batch = predict(List.of(request.baseline(), scenario), List.of("baseline", "scenario"));
        Prediction base = batch.predictions().get(0);
        Prediction changed = batch.predictions().get(1);
        double delta = changed.predictedPrice() - base.predictedPrice();
        return new WhatIfResult(
                request.baseline(),
                scenario,
                base.predictedPrice(),
                changed.predictedPrice(),
                round(delta),
                round(delta / base.predictedPrice() * 100),
                base.warnings(),
                changed.warnings(),
                batch.modelVersion());
    }

    @Cacheable(cacheNames = "sensitivity", key = "{#modelVersion, #request}")
    public SensitivityResult sensitivity(SensitivityRequest request, String modelVersion) {
        Feature feature = Feature.fromKey(request.feature()).orElseThrow();
        List<HouseFeatures> homes = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < request.steps(); i++) {
            double value = request.from() + (request.to() - request.from()) * i / (request.steps() - 1);
            homes.add(request.baseline().with(feature, value));
            labels.add(feature.key() + "=" + feature.toValid(value));
        }
        BatchPrediction batch = predict(homes, labels);
        List<Point> points = new ArrayList<>();
        for (int i = 0; i < homes.size(); i++) {
            Prediction p = batch.predictions().get(i);
            points.add(new Point(valueOf(feature, homes.get(i)), p.predictedPrice(), p.warnings()));
        }
        return new SensitivityResult(feature.key(), points, batch.modelVersion());
    }

    /** One batch call; when the model can't price an item, the problem says which (by label, not index). */
    private BatchPrediction predict(List<HouseFeatures> homes, List<String> labels) {
        try {
            return ml.predictBatch(homes);
        } catch (MlApiException e) {
            if ("outside-model-domain".equals(e.type()) && e.indices() != null && !e.indices().isEmpty()) {
                List<String> which = e.indices().stream().map(labels::get).toList();
                throw MlApiException.rejected("outside-model-domain",
                        "The model can't price " + String.join(", ", which)
                                + ": it predicts a price at or below $0, far from the homes it was trained on",
                        null, e.indices());
            }
            throw e;
        }
    }

    private static double valueOf(Feature feature, HouseFeatures home) {
        return switch (feature) {
            case SQUARE_FOOTAGE -> home.squareFootage();
            case BEDROOMS -> home.bedrooms();
            case BATHROOMS -> home.bathrooms();
            case YEAR_BUILT -> home.yearBuilt();
            case LOT_SIZE -> home.lotSize();
            case DISTANCE_TO_CITY_CENTER -> home.distanceToCityCenter();
            case SCHOOL_RATING -> home.schoolRating();
        };
    }

    private static double round(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
