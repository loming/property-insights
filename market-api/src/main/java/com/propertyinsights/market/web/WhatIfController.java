package com.propertyinsights.market.web;

import com.propertyinsights.market.whatif.WhatIfService;
import com.propertyinsights.market.whatif.WhatIfViews.SensitivityRequest;
import com.propertyinsights.market.whatif.WhatIfViews.SensitivityResult;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfRequest;
import com.propertyinsights.market.whatif.WhatIfViews.WhatIfResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market")
@Tag(name = "what-if", description = "Price changes predicted by the Task 1 model")
public class WhatIfController {

    private final WhatIfService whatIf;

    public WhatIfController(WhatIfService whatIf) {
        this.whatIf = whatIf;
    }

    @PostMapping("/what-if")
    @Operation(summary = "Price a baseline home and a changed one in one model call",
            description = "Only the features in `changes` differ; the rest keep the baseline's values, so results "
                    + "are 'holding other features constant'. Cached for 10 minutes per model version.")
    public WhatIfResult whatIf(@Valid @RequestBody WhatIfRequest request) {
        return whatIf.whatIf(request);
    }

    @PostMapping("/what-if/sensitivity")
    @Operation(summary = "How the price moves as one feature sweeps a range (2-50 steps, one model call)")
    public SensitivityResult sensitivity(@Valid @RequestBody SensitivityRequest request) {
        return whatIf.sensitivity(request);
    }

    @GetMapping("/model-info")
    @Operation(summary = "The Task 1 model's /model-info, cached for 10 minutes",
            description = "Lets App 2 show the model's details without depending on App 1's backend.")
    public Map<String, Object> modelInfo() {
        return whatIf.modelInfo();
    }
}
