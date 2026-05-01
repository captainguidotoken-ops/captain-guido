# Security Policy

The Captain Guido Coin team takes the security of this project — both the public
website and the admin proxy server — seriously. Thank you for helping keep our
community and our charity partners safe.

## Supported Versions

The project is a single deployment; only the latest commit on `main` is supported.
Branches and forks are not covered.

| Component                | Supported   |
| ------------------------ | ----------- |
| Public site (`main`)     | ✅ yes      |
| Admin server (`server/`) | ✅ yes      |
| Old branches / forks     | ❌ no       |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.**

Use one of the following private channels:

1. **GitHub Security Advisories (preferred):**
   <https://github.com/captainguidotoken-ops/captain-guido/security/advisories/new>
2. **Email:** captainguidotoken@gmail.com — subject line `[SECURITY]`.

Please include:

- A short description of the issue and its impact.
- Steps to reproduce, ideally with a minimal proof-of-concept.
- The affected URL, file, or commit.
- Whether you would like to be credited in the disclosure.

## What to Expect

- **Acknowledgement:** within 72 hours.
- **Triage + initial assessment:** within 7 days.
- **Fix or mitigation:** depending on severity, typically within 30 days for
  high/critical issues.
- **Coordinated disclosure:** we'll work with you on a public timeline; please
  give us a reasonable window before public release.

## Out of Scope

The following are generally **not** considered security vulnerabilities:

- Reports based on outdated versions.
- Self-XSS that requires the victim to paste attacker-controlled scripts.
- Theoretical issues without a working proof-of-concept.
- Lack of rate limiting on routes that have no authenticated state.
- Missing security headers on static assets that don't accept user input.
- Findings from automated scanners with no demonstrated exploit path.

## Safe Harbour

We will not pursue legal action against researchers who:

- Make a good-faith effort to follow this policy.
- Avoid privacy violations, destruction of data, and interruption of service.
- Do not exfiltrate more data than is necessary to demonstrate impact.
- Give us reasonable time to fix issues before public disclosure.

## Hall of Fame

Acknowledged researchers (with their permission) will be listed in the project
README once we receive our first valid report.
