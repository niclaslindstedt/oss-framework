# Security Policy

## Supported versions

The framework is pre-1.0. Security fixes are applied to the latest released
minor version only. Pin a version and upgrade to receive fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

Please report vulnerabilities privately — **do not open a public issue**.

- Preferred: open a [GitHub Security Advisory](https://github.com/niclaslindstedt/oss-framework/security/advisories/new).
- Alternatively, email **niclas@agilator.se** with details and reproduction steps.

## Response expectations

- Acknowledgment within **5 business days**.
- An initial assessment and triage within **10 business days**.

## Disclosure policy

We follow coordinated disclosure: we will agree on a disclosure window with the
reporter and credit them unless they prefer to remain anonymous.

## Scope

In scope: the published package code under `src/` and its build output.

Out of scope: vulnerabilities in the consuming application, in transitive
dependencies (report those upstream), or in the source apps (`notes`,
`checklist`) cloned only for local analysis.
