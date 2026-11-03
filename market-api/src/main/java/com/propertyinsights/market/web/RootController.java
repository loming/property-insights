package com.propertyinsights.market.web;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.view.RedirectView;

@Controller
@Hidden
public class RootController {

    /** The root opens Swagger; behind the gateway the forwarded prefix keeps it under /market-api/. */
    @GetMapping("/")
    RedirectView root() {
        return new RedirectView("/swagger-ui.html", true);
    }
}
