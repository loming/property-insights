# 0006 · Spring Boot exactly 3.4.4, with same-line patches and an image scan

- **Status:** Accepted, 2 Nov 2026; patches and scan added 3 Nov 2026 (DEC-11)
- **Requirements:** C-1, M-6

## Context

The brief pins Spring Boot 3.4.4. The 3.4 line is out of open-source support, and the versions it manages have known advisories: an image scan of `market-api` found 39.

## Decision

`market-api` uses Spring Boot 3.4.4 exactly. Its dependencies move to the latest release of their own line, set as properties in [`market-api/pom.xml`](../../market-api/pom.xml):

| Library | Boot 3.4.4 manages | Used here |
|---|---|---|
| Tomcat | 10.1.39 | 10.1.61 |
| Spring Framework | 6.2.5 | 6.2.19, the line's last public release |
| Jackson | 2.18.3 | 2.18.12 |
| Logback | 1.5.18 | 1.5.38 |
| commons-lang3 | 3.17.0 | 3.21.0 |
| Log4j API (only the SLF4J bridge uses it) | 2.24.3 | 2.25.5, since 2.24 has no fix |

springdoc stays on 2.8.6, the last release built against Boot 3.4.

CI scans every built image with OSV-Scanner. A finding fails the build unless [`osv-scanner.toml`](../../osv-scanner.toml) sets it aside with a reason and a date to look again. Two Spring Framework advisories are set aside that way: both are fixed only in 7.0, and they concern features `market-api` doesn't use (server-sent event fragments and `XsltView`).

## Consequences

- The brief's version is honoured, and the scan shows what that costs.
- The overrides step outside the combinations Boot 3.4.4 was tested with. `./mvnw verify` and the browser tests pass with them, but every future patch needs the same check.
- Production would move to a supported line (Spring Boot 4.1), or keep 3.4 under commercial support, which still ships 6.2 patches.

## Alternatives considered

- **Boot 3.4.13, the last 3.4 patch.** Fewer advisories, but not what the brief says, and it's out of support too.
- **Boot 3.5 or 4.x.** Supported, but it ignores an explicit requirement.
- **OWASP Dependency-Check on the pom.** It covers Java only and is slow without an NVD API key. OSV-Scanner reads the image as built, so it also covers the Python wheels, the portal's `node_modules` and the OS packages.
