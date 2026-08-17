# Spec: Issue #198 user-facing error presentation

## Objective

Give every migrated UI path one resolver that turns unknown transport errors and
API envelopes into localized user-facing copy. Server `message` is diagnostic
data only; it is never a UI fallback.

## Interface

`resolveUserFacingError(error, translate, { codeKeys? })` returns the localized
`message`, parsed `code` and `requestId`, and a `presentation` classification.
The resolver applies actionable code keys first, then HTTP-status keys, then
network/timeout keys, then a localized unknown key.

## First vertical slice

- Canonical envelope types allow request IDs and non-enumerated server codes.
- Shared resolver and common `errorPresentation` catalog keys are covered by
  small Vitest tests.
- Customer order submission supplies its dedicated code registry to the shared
  resolver; English-message regular expressions are removed.
- API error envelopes include the request ID and CORS exposes its header.

## Success criteria

- An unknown server message such as `Invalid username or password` cannot be
  returned as UI text by the resolver.
- Unknown legacy responses fall back to localized status text.
- The customer order-submit path continues to map its known codes.
- Request IDs are present in app-factory error envelopes and readable by
  browser clients.

## Boundaries

- Always: add a failing regression test before each behavior change and retain
  raw messages for logging/telemetry only.
- Ask first: mass-migrate the remaining UI call sites or alter every legacy API
  route.
- Never: use server prose as a classification or presentation fallback.
