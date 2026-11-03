package com.propertyinsights.market.whatif;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * A failed model call and the problem this service answers with, mapped the same way as in the Python
 * services (doc 02, C6 and D7): the model's 422s pass through, a model error is 502, unreachable is 503.
 */
public class MlApiException extends RuntimeException {

    private final HttpStatus status;
    private final String type;
    private final List<Map<String, String>> errors;
    private final List<Integer> indices;

    private MlApiException(HttpStatus status, String type, String detail, List<Map<String, String>> errors,
            List<Integer> indices, Throwable cause) {
        super(detail, cause);
        this.status = status;
        this.type = type;
        this.errors = errors;
        this.indices = indices;
    }

    public static MlApiException unavailable(String detail, Throwable cause) {
        return new MlApiException(HttpStatus.SERVICE_UNAVAILABLE, "model-unavailable", detail, null, null, cause);
    }

    public static MlApiException badResponse(String detail) {
        return new MlApiException(HttpStatus.BAD_GATEWAY, "model-error", detail, null, null, null);
    }

    public static MlApiException rejected(String type, String detail, List<Map<String, String>> errors,
            List<Integer> indices) {
        return new MlApiException(HttpStatus.UNPROCESSABLE_ENTITY, type, detail, errors, indices, null);
    }

    public HttpStatus status() {
        return status;
    }

    public String type() {
        return type;
    }

    public List<Map<String, String>> errors() {
        return errors;
    }

    public List<Integer> indices() {
        return indices;
    }
}
