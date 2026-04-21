# Security Review: main (full codebase)

**Date**: 2026-04-21  
**Reviewer**: Claude (automated security audit)  
**Scope**: Full application codebase — all API routes, auth, middleware, database layer, and frontend  
**Compliance**: OWASP Top 10 (2021), OWASP API Security Top 10 (2023), HIPAA, SOC 2

---

## Executive Summary

The application has a solid security foundation: Google OAuth with next-auth v5, JWT sessions, per-endpoint rate limiting, input validation on file type/size, and Prisma ORM preventing SQL injection. No critical vulnerabilities were found. The most significant concern is the **in-memory rate limiter**, which resets on restart and is bypassed entirely in multi-instance deployments — this makes the OpenAI and Apify cost controls ineffective at scale. Supporting issues include missing security headers, absent security event logging, and no runtime validation of external API responses. No PHI is handled by this application.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 3 |
| Low      | 3 |

---

## High Findings

### [HIGH] In-memory rate limiter is not durable or instance-safe

- **Standard**: A04:2021 — Insecure Design / API4:2023 — Unrestricted Resource Consumption
- **Category**: Auth / Resource Consumption
- **File**: `lib/ratelimit.ts:1-18`
- **Description**: The rate limiter stores request counts in a Node.js `Map` in process memory. Every server restart resets all buckets, and each Render instance has its own independent store. A user can bypass the 5 req/min or 10 req/min limit by either restarting the server, or in a scaled deployment, routing requests across instances.
- **Risk**: Each `search-jobs` call triggers up to 11 parallel Apify scraper runs (~$0.30–$0.60 each) and multiple GPT-4o scoring calls. A bypass enables unbounded cost accumulation on the OpenAI and Apify accounts.
- **Remediation**: Replace with a Redis-backed rate limiter. On Render, add a Redis instance and use `ioredis` with a sliding window:

```ts
// lib/ratelimit.ts — Redis-backed replacement
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;
  const count = await redis.incr(windowKey);
  if (count === 1) await redis.pexpire(windowKey, windowMs);
  return count <= max;
}
```

> Until Redis is added, set `maxInstances: 1` in your Render service to limit to a single instance, which at least prevents the multi-instance bypass.

---

## Medium Findings

### [MEDIUM] Missing security event logging

- **Standard**: A09:2021 — Security Logging and Monitoring Failures / SOC 2 (Availability, Security)
- **Category**: Logging
- **File**: `app/api/analyze-cv/route.ts:14-17`, `app/api/search-jobs/route.ts:14-17`, `lib/ratelimit.ts`
- **Description**: Authentication failures (missing session), rate limit violations, and API errors are silently returned to the client with no server-side logging. SOC 2 requires evidence of security event monitoring and the ability to detect and investigate incidents.
- **Risk**: No visibility into abuse patterns, authentication anomalies, or cost-spike events. An attacker probing the API leaves no trace.
- **Remediation**: Add structured logging at key security boundaries:

```ts
// app/api/search-jobs/route.ts
if (!session?.user?.email) {
  console.warn("[auth] Unauthenticated request to search-jobs", {
    ip: req.headers.get("x-forwarded-for"),
    ua: req.headers.get("user-agent"),
  });
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

if (!checkRateLimit(...)) {
  console.warn("[ratelimit] Limit exceeded", { user: session.user.email, endpoint: "search-jobs" });
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

---

### [MEDIUM] No runtime schema validation on external API responses

- **Standard**: API10:2023 — Unsafe Consumption of APIs / A08:2021 — Software and Data Integrity Failures
- **Category**: Input Validation
- **File**: `lib/scoreJobs.ts:47`, `lib/apify.ts:56`
- **Description**: OpenAI and Apify responses are consumed with TypeScript type casts (`as CandidateProfile`, `as IndeedRawJob[]`) but no runtime validation. If either API returns an unexpected shape — due to an API change, error response, or degraded response — the app may silently produce incorrect data or throw an unhandled exception.

```ts
// lib/scoreJobs.ts — currently
const parsed = JSON.parse(content) as { scores?: ScoreEntry[] };

// lib/apify.ts — currently
return (items as IndeedRawJob[]).map(normalizeIndeedJob);
```

- **Risk**: Malformed OpenAI scoring responses could assign wrong scores silently. Unexpected Apify data shapes could expose `undefined` values in job listings.
- **Remediation**: Add lightweight Zod validation on external API boundaries:

```ts
// install: npm install zod
import { z } from "zod";

const ScoreResponseSchema = z.object({
  scores: z.array(z.object({ index: z.number(), score: z.number() })).default([]),
});

const parsed = ScoreResponseSchema.parse(JSON.parse(content));
```

---

### [MEDIUM] Missing HTTP security headers

- **Standard**: A05:2021 — Security Misconfiguration / API8:2023 — Security Misconfiguration
- **Category**: Configuration
- **File**: `next.config.ts`
- **Description**: Next.js does not add security headers by default. The app currently sends no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers. This leaves the app open to clickjacking, MIME-type sniffing, and makes it harder for browsers to enforce HTTPS.
- **Risk**: Clickjacking attacks could embed the app in an iframe. Without CSP, any future XSS would have maximum impact.
- **Remediation**: Add to `next.config.ts`:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",  // tighten after auditing inline scripts
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
```

> **Auto-fixable** — see Auto-Fix Offer below.

---

## Low Findings

### [LOW] Prompt injection risk in CV analysis

- **Standard**: A03:2021 — Injection
- **Category**: Injection
- **File**: `app/api/analyze-cv/route.ts:55-62`
- **Description**: The raw CV text is embedded directly into the OpenAI prompt between `<cv>` tags. The system prompt instructs the model to ignore instructions within the CV, which is a reasonable mitigation. However, adversarial CV content could still attempt to override the extraction format or cause the model to return non-JSON responses.
- **Risk**: Low in this context — the worst realistic outcome is malformed JSON (already handled by the `response_format: json_object` constraint) or an extracted profile that reflects injected content rather than actual CV data.
- **Remediation**: The existing mitigation (`response_format: json_object` + instructed to ignore inner instructions) is acceptable. As an additional layer, validate that the returned JSON fields match expected types before using them:

```ts
// After JSON.parse — validate shape before using
if (!Array.isArray(profile.skills) || typeof profile.experience !== "string") {
  return NextResponse.json({ error: "Invalid CV analysis result" }, { status: 500 });
}
```

---

### [LOW] Pre-release dependency in production path

- **Standard**: A06:2021 — Vulnerable and Outdated Components
- **Category**: Dependencies
- **File**: `package.json:20`
- **Description**: `next-auth: ^5.0.0-beta.31` is a pre-release version. Beta software may have unpatched security issues, breaking API changes, or undiscovered vulnerabilities.
- **Risk**: Low for a personal/internal tool. Higher if this handles sensitive user data at scale.
- **Remediation**: Monitor the next-auth v5 stable release. When `5.0.0` stable ships, upgrade. In the meantime, pin to a specific beta (`5.0.0-beta.31`) rather than `^5.0.0-beta.31` to avoid unexpected beta-to-beta upgrades with breaking changes:

```json
"next-auth": "5.0.0-beta.31"
```

---

### [LOW] CV content transmitted to third-party AI service

- **Standard**: A02:2021 — Cryptographic Failures (data in transit to third party)
- **Category**: Data Privacy
- **File**: `app/api/analyze-cv/route.ts:46-67`
- **Description**: The full text of uploaded CVs (including personal information like name, address, work history) is transmitted to OpenAI's API for processing. There is no mention of a data processing agreement (DPA) with OpenAI, data retention policy, or user consent for third-party processing.
- **Risk**: GDPR/privacy compliance risk if serving EU users. OpenAI may retain data for model improvement by default unless opted out via API settings.
- **Remediation**:
  - Ensure your OpenAI account has data retention/training opt-out configured (OpenAI API calls do not train models by default, but verify this in your account settings)
  - Add a privacy notice on the upload UI informing users their CV is processed by OpenAI
  - Consider adding a `/privacy` page documenting third-party data processors

---

## OWASP Coverage

| OWASP ID   | Title                                           | Findings |
|------------|-------------------------------------------------|----------|
| A01:2021   | Broken Access Control                           | None |
| A02:2021   | Cryptographic Failures                          | 1 Low (CV to OpenAI) |
| A03:2021   | Injection                                       | 1 Low (prompt injection) |
| A04:2021   | Insecure Design                                 | 1 High (in-memory rate limiter) |
| A05:2021   | Security Misconfiguration                       | 1 Medium (missing security headers) |
| A06:2021   | Vulnerable and Outdated Components              | 1 Low (next-auth beta) |
| A07:2021   | Identification and Authentication Failures      | None |
| A08:2021   | Software and Data Integrity Failures            | 1 Medium (no external API schema validation) |
| A09:2021   | Security Logging and Monitoring Failures        | 1 Medium (missing security event logging) |
| A10:2021   | Server-Side Request Forgery (SSRF)              | None |
| API1:2023  | Broken Object Level Authorization               | None |
| API2:2023  | Broken Authentication                           | None |
| API3:2023  | Broken Object Property Level Authorization      | None |
| API4:2023  | Unrestricted Resource Consumption               | 1 High (rate limiter bypass) — deduplicated with A04 |
| API5:2023  | Broken Function Level Authorization             | None |
| API6:2023  | Unrestricted Access to Sensitive Business Flows | None |
| API7:2023  | Server Side Request Forgery                     | None |
| API8:2023  | Security Misconfiguration                       | 1 Medium (security headers) — deduplicated with A05 |
| API9:2023  | Improper Inventory Management                   | None |
| API10:2023 | Unsafe Consumption of APIs                      | 1 Medium (external API validation) — deduplicated with A08 |

---

## HIPAA Compliance Section

This application does **not** handle Protected Health Information (PHI) as defined under HIPAA. It processes CV/résumé data (PII) and job listings. HIPAA controls are not applicable. No PHI exposure concerns were identified.

---

## SOC 2 Compliance Section

Two SOC 2 gaps were identified:

1. **Security event logging (Medium)**: Authentication failures and rate limit violations are not logged, limiting the ability to detect and investigate security incidents. This affects the **Security** trust service criterion.
2. **In-memory rate limiter (High)**: Rate limits reset on restart, reducing confidence in availability and cost controls. This affects the **Availability** trust service criterion.

No gaps were found in access control (auth middleware covers all routes), encryption in transit (HTTPS enforced by Render), or change management.

---

## Auto-Fix Offer

I can automatically fix the following 1 issue:

1. **Missing security headers** — `next.config.ts` (Medium, A05:2021)

Would you like me to fix this? (yes / no)

---

## Recommendations

**Immediate**
- Replace the in-memory rate limiter with a Redis-backed implementation (or pin to 1 Render instance as a temporary measure)

**This sprint**
- Add security event logging to both API routes (auth failures, rate limit hits)
- Add Zod schema validation for OpenAI and Apify responses
- Add HTTP security headers to `next.config.ts`

**Next sprint**
- Add a privacy notice informing users that CVs are processed by OpenAI
- Pin `next-auth` to an exact beta version; upgrade to stable when released
- Consider a `/api/usage` or admin endpoint to monitor per-user search counts

---

## Automated Scan Suggestions

- Run `npm audit` to check for known CVEs in current dependencies
- Run `npx tsc --noEmit` periodically to catch type safety regressions
- Consider adding `npm audit` to the CI/CD pipeline (Render pre-deploy command)
