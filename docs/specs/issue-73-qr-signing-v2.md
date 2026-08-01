# Spec: Issue #73 QR Signing v2 Transition

## Objective

Eliminate table/seat QR identity collisions and make QR regeneration revoke old
codes.

Phase 1 emitted the v2 format while validators still accepted legacy signatures
matching the current database row and `qrCodeVersion`. **Phase 3 has landed
(#88): v2 is now the only format that is produced or accepted.** A URL without
`f=2` and a positive `d={tableId}` fails at parse time, before any database
lookup, so there is no longer a downgrade path for codes that were never
regenerated.

The cutoff was taken while production had no live users, which is why no grace
window was needed.

## Tech Stack

- TypeScript, Web Crypto HMAC-SHA256, Hono, Drizzle ORM, Cloudflare D1
- Vitest for utility, service, and route regression tests

## Commands

- Focused tests:
  `pnpm --filter @makanmakan/utils test -- src/qr-signing.test.ts`
- API tests:
  `pnpm --filter @makanmakan/api test --run src/features/qr-codes src/features/realtime`
- Type checks:
  `pnpm --filter @makanmakan/utils typecheck &&
  pnpm --filter @makanmakan/api typecheck`
- Repository gates:
  `pnpm lint && pnpm typecheck`

## Project Structure

- `packages/utils/src/qr-signing.ts`: format-aware signing, parsing, and
  dual-accept verification
- `packages/database/src/services/{table,seat}.ts`: v2 QR producers
- `apps/api/src/features/qr-codes/`: public table/seat verification
- `apps/api/src/features/realtime/`: guest realtime table/seat authorization
- Tests remain beside their owning modules as `*.test.ts`

## Code Style

Use explicit format and identity fields rather than inferring them:

```ts
const payload = {
  formatVersion: 2 as const,
  type: "seat" as const,
  restaurantId,
  tableId,
  identifier: seatNumber,
  version: qrCodeVersion,
};
```

Formatting follows repository Prettier rules (2 spaces, semicolons, double
quotes, trailing commas).

## Testing Strategy

- Unit tests prove v2 signatures bind `tableId`, v2 URLs round-trip, and
  legacy URLs remain verifiable.
- API service/route tests prove current DB versions pass, regenerated old
  versions fail, identity mismatches fail, and both public endpoints exist.
- Realtime tests prove both table and seat QR codes authorize only the matching
  table/seat and current version.
- Run affected package type checks and repository lint/typecheck gates.

## Boundaries

- Always: validate parsed numeric fields, bind signatures to `tableId`, compare
  QR version with the database, require active/non-deleted records.
- Ask first: schema migrations, new dependencies, or reintroducing acceptance of
  any format other than v2.
- Never: log signing keys/signatures, trust URL identity without a DB match, or
  silently accept an unknown signing format. In particular, a missing `f` marker
  must be rejected rather than treated as legacy — that downgrade is exactly
  what phase 3 removed.

## Success Criteria

1. Newly generated table and seat URLs include `f=2` and `d={tableId}` and use
   canonical input
   `v2|{type}|{restaurantId}|{tableId}|{identifier}|{version}`.
2. Legacy URLs without `f`/`d` are rejected outright. `parseSignedQRUrl` returns
   null for them, so they never reach a database comparison, and matching the
   stored value does not rescue them.
3. Seat `01` on two different tables produces different signatures.
4. Regenerating a table or seat makes its previous QR fail DB-backed
   verification.
5. Public endpoints return only validated, minimal identity data. The feature is
   mounted at `/qr` (`app-factory.ts`: `apiV1.route("/qr", ...)`), not
   `/qr-codes`, and there are two forms of each:

   - `GET /api/v1/qr/verify/table?qrCode=...`
     `GET /api/v1/qr/verify/seat?qrCode=...`
     Resolve identity from the payload itself. This is what the customer app
     calls (`signedQrApi.verify`), because a scanner only has the URL.
   - `GET /api/v1/qr/verify/table/:entityId?qrCode=...`
     `GET /api/v1/qr/verify/seat/:entityId?qrCode=...`
     Assert the QR belongs to a specific known row.
6. Guest realtime token generation supports table and seat QR payloads and
   rejects cross-table, cross-seat, inactive, deleted, or stale-version codes.

## Status

- Phase 1 (v2 format + dual-accept): done.
- Phase 2 (inventory, atomic bulk regeneration, batch printing): done — see #88.
  `pnpm audit:qr-format [production]` reports anything still non-v2 and exits
  non-zero while work remains.
- Phase 3 (legacy cutoff): done. `generateLegacyQRCodeData` is gone, so nothing
  can mint a v1 code, and `parseSignedQRUrl` refuses to read one.
