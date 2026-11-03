package com.propertyinsights.market.web;

import com.propertyinsights.market.whatif.MlApiException;
import com.propertyinsights.market.whatif.MlClient;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.Errors;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Every error as RFC 9457 problem+json, in the same shape as the Python services: a type slug, the request
 * ID and, for validation, a list of {field, message} with snake_case field names. Extending
 * ResponseEntityExceptionHandler covers Spring's own errors (404, 405, 415, type mismatches) too, since
 * spring.mvc.problemdetails.enabled is off by default (doc 02, D13).
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MlApiException.class)
    ResponseEntity<ProblemDetail> handleModelFailure(MlApiException e) {
        log.warn("model call failed: {}", e.getMessage());
        ProblemDetail problem = problem(e.status(), e.type(), e.getMessage());
        if (e.errors() != null) {
            problem.setProperty("errors", e.errors());
        }
        if (e.indices() != null) {
            problem.setProperty("indices", e.indices());
        }
        return ResponseEntity.status(e.status()).body(problem);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception e) {
        log.error("unhandled error", e);
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status)
                .body(problem(status, "internal-error", "Something went wrong; quote the request_id when reporting it"));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = body instanceof ProblemDetail detail
                ? detail
                : ProblemDetail.forStatusAndDetail(status, ex.getMessage());
        problem.setType(URI.create(typeFor(status)));
        problem.setProperty("request_id", MDC.get(MlClient.REQUEST_ID_MDC_KEY));
        List<Map<String, String>> errors = fieldErrors(ex);
        if (!errors.isEmpty()) {
            problem.setDetail("The request has invalid fields");
            problem.setProperty("errors", errors);
        }
        if (ex instanceof HttpMessageNotReadableException) {
            problem.setDetail("The request body isn't valid JSON for this endpoint: check field names and types");
        }
        return super.handleExceptionInternal(ex, problem, headers, status, request);
    }

    private static List<Map<String, String>> fieldErrors(Exception ex) {
        List<Map<String, String>> errors = new ArrayList<>();
        if (ex instanceof MethodArgumentNotValidException e) {
            addBindingErrors(e.getBindingResult(), errors);
        } else if (ex instanceof HandlerMethodValidationException e) {
            e.getParameterValidationResults().forEach(result -> {
                if (result instanceof ParameterErrors parameterErrors) {
                    addBindingErrors(parameterErrors, errors);
                } else {
                    String name = result.getMethodParameter().getParameterName();
                    result.getResolvableErrors().forEach(error -> errors.add(error(name, error.getDefaultMessage())));
                }
            });
        } else if (ex instanceof TypeMismatchException e) {
            String message = e.getMostSpecificCause() instanceof IllegalArgumentException cause
                    ? cause.getMessage()
                    : "has an invalid value";
            errors.add(error(e.getPropertyName(), message));
        } else if (ex instanceof MissingServletRequestParameterException e) {
            errors.add(error(e.getParameterName(), "is required"));
        }
        return errors;
    }

    private static void addBindingErrors(Errors result, List<Map<String, String>> errors) {
        for (FieldError e : result.getFieldErrors()) {
            errors.add(error(e.getField(), e.isBindingFailure() ? "has an invalid value" : e.getDefaultMessage()));
        }
        result.getGlobalErrors().forEach(e -> errors.add(error(result.getObjectName(), e.getDefaultMessage())));
    }

    private static Map<String, String> error(String field, String message) {
        return Map.of("field", snakeCase(field == null ? "request" : field), "message", String.valueOf(message));
    }

    /** baseline.squareFootage → baseline.square_footage, matching the JSON and query names. */
    static String snakeCase(String name) {
        return name.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
    }

    private static ProblemDetail problem(HttpStatusCode status, String type, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(type));
        problem.setProperty("request_id", MDC.get(MlClient.REQUEST_ID_MDC_KEY));
        return problem;
    }

    private static String typeFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "validation-error";
            case 404 -> "not-found";
            case 405 -> "method-not-allowed";
            case 406 -> "not-acceptable";
            case 415 -> "unsupported-media-type";
            default -> "about:blank";
        };
    }
}
