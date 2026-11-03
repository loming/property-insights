# syntax=docker/dockerfile:1
# Task 2, App 2 backend. The dataset arrives through the Compose additional build context "data",
# like ml-api's, so data/ stays the single source of truth (doc 02, F3).

# JDK and OS pinned: the floating 21 tags moved to Ubuntu 26.04 (resolute) recently (doc 03 §4.3).
FROM eclipse-temurin:21.0.13_9-jdk-resolute AS builder
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
# Committed executable with LF endings; this is the cheap safety net (doc 02, A7).
RUN chmod +x mvnw
COPY src src
# Tests run in CI: they read ../data and ../ml-api, which are outside this build context.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
    && cp target/market-api.jar /src/application.jar
WORKDIR /builder
# Boot 3.4's layered extraction; most tutorials still show the deprecated layertools form (doc 02, D13).
RUN java -Djarmode=tools -jar /src/application.jar extract --layers --destination extracted

FROM eclipse-temurin:21.0.13_9-jre-resolute AS runtime
# The Temurin images run as root by default.
RUN useradd --system --uid 10001 --create-home app
WORKDIR /app
# Least- to most-often-changed layers, so a code change rebuilds only the last one.
COPY --from=builder /builder/extracted/dependencies/ ./
COPY --from=builder /builder/extracted/spring-boot-loader/ ./
COPY --from=builder /builder/extracted/snapshot-dependencies/ ./
COPY --from=builder /builder/extracted/application/ ./
COPY --from=data house_prices.csv /app/data/house_prices.csv
USER app
EXPOSE 8080
# The JRE image has curl.
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=3 \
    CMD ["curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:8080/actuator/health"]
# The heap is sized from the compose mem_limit. Without a limit, 75% would mean 75% of the whole VM
# (doc 02, A6).
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "application.jar"]
