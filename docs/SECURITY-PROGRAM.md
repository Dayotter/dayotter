# DayOtter — Secure Development Lifecycle (SSDLC)

How security is built into how we ship DayOtter. This document is the reference
for our secure development process and the automated testing that backs it. It
complements [`SECURITY.md`](../SECURITY.md) (how to report a vulnerability) and
the [Privacy Policy](https://dayotter.com/privacy).

## Development process

- **All changes ship through pull requests.** No direct pushes of feature work
  to `main`; every change is reviewed before merge.
- **CI must pass before merge** — lint/format (Biome), type-checking
  (`tsc --noEmit` across the workspace), and the automated test suite. See
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- **Strong typing end to end.** TypeScript in strict mode; runtime input is
  validated with Zod at trust boundaries (API routes, webhooks, OAuth callbacks).
- **Least privilege.** Third-party integrations request the narrowest scopes that
  make the feature work (e.g. Google Calendar uses `calendar.readonly` +
  `calendar.events`; Zoom uses `user:read:user` + `meeting:write:meeting`).

## Automated security testing

Every push and pull request runs, and the same scans run on a weekly schedule so
newly-disclosed issues are caught even without code changes:

| Class | Tool | Where |
|---|---|---|
| **SAST** (static analysis) | CodeQL (`security-extended`) | [`codeql.yml`](../.github/workflows/codeql.yml) |
| **SAST** (patterns / OWASP Top 10) | Semgrep (`p/security-audit`, `p/secrets`, `p/typescript`, `p/react`, `p/nextjs`) | [`security.yml`](../.github/workflows/security.yml) |
| **Secret scanning** | Gitleaks | [`security.yml`](../.github/workflows/security.yml) |
| **SCA** (dependency CVEs) | `pnpm audit` + Dependabot | [`security.yml`](../.github/workflows/security.yml), [`dependabot.yml`](../.github/dependabot.yml) |
| **DAST** (running app) | OWASP ZAP baseline | [`dast-zap.yml`](../.github/workflows/dast-zap.yml) |

SAST, secret-scan, and SCA results surface in the repository's **Security → Code
scanning** tab. The ZAP baseline is a passive, non-intrusive scan of the deployed
site (headers, TLS, cookies, common misconfigurations) — it does not attack or
fuzz.

## Dependency & supply-chain management

- **Dependabot** opens weekly PRs for application dependencies and for the GitHub
  Actions used by these workflows.
- **`pnpm audit`** flags high/critical advisories in CI.
- Lockfile-pinned installs everywhere (`pnpm install --frozen-lockfile`).

## Secrets & data protection

- **No secrets in code.** Credentials (OAuth client secrets, API keys, signing
  keys) come from environment configuration only; Gitleaks guards against
  accidental commits.
- **Encryption at rest.** OAuth access/refresh tokens (Google, Microsoft, Zoom,
  etc.), notification secrets, and webhook signing keys are encrypted with
  **AES-256-GCM** before storage in PostgreSQL; API keys are stored only as
  hashes. The encryption key lives only in server environment configuration.
- **Encryption in transit.** All traffic, including calls to third-party APIs, is
  over **TLS 1.2+**. Client secrets and tokens never reach the browser — all
  third-party API calls are server-side.
- **SSRF-safe egress.** Outbound fetches to user-supplied destinations (e.g.
  CalDAV, ICS feeds, webhooks) go through a pinned, allow-listed fetch layer to
  prevent server-side request forgery.
- **Scoped access.** Data access is scoped per authenticated user and
  organization.

## Vulnerability disclosure

Security issues are reported privately per [`SECURITY.md`](../SECURITY.md), not via
public issues. We triage and remediate reports and coordinate disclosure.

## Data handling for Marketplace integrations

Third-party user data (e.g. Google Workspace / Zoom) is used **solely to provide
the user-facing scheduling features** the user requested — never for advertising,
never sold, and never used to develop, improve, or train generalized or
foundational AI/ML models. This adheres to each provider's Limited Use / API user
data policy. Users can disconnect any integration at any time, which deletes the
stored tokens for that account.
