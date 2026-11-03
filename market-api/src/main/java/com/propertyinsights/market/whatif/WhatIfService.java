package com.propertyinsights.market.whatif;

import com.propertyinsights.market.whatif.WhatIfViews.SensitivityRequest;
import com.propertyinsights.market.whatif.WhatIfViews.SensitivityResult;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfRequest;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfResult;
import java.util.Map;
import org.springframework.stereotype.Service;

/** What-if analysis through the Task 1 model, cached per model version. */
@Service
public class WhatIfService {

    private final ModelCalls calls;

    public WhatIfService(ModelCalls calls) {
        this.calls = calls;
    }

    public Map<String, Object> modelInfo() {
        return calls.modelInfo();
    }

    public WhatIfResult whatIf(WhatIfRequest request) {
        return calls.whatIf(request, modelVersion());
    }

    public SensitivityResult sensitivity(SensitivityRequest request) {
        return calls.sensitivity(request, modelVersion());
    }

    /** From the cached /model-info (10 minutes), so a new model invalidates cached predictions. */
    private String modelVersion() {
        return String.valueOf(calls.modelInfo().getOrDefault("model_version", "unknown"));
    }
}
