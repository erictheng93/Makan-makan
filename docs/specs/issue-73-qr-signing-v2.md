# Spec: Issue #73 QR Signing v2 Transition

## Objective

Eliminate table/seat QR identity collisions and make QR regeneration revoke old
codes without immediately invalidating already printed codes. Phase 1 emits a
new signed format while validators continue accepting legacy signatures whose
payload still matches the current database record and `qrCodeVersion`.

## Tech Stack

- TypeScript, Web Crypto HMAC-SHA256, Hono, Drizzle ORM, Cloudflare D1
- Vitest for utility, service, and route regression tests

## Commands

- Focused tests:
  `rtk pnpm --filter @makanmakan/utils test -- src/qr-signing.test.ts`
- API tests:
  `rtk pnpm --filter @makanmakan/api test --run src/features/qr-codes src/features/realtime`
- Type checks:
  `rtk pnpm --filter @makanmakan/utils typecheck &&
  rtk pnpm --filter @makanmakan/api typecheck`
- Repository gates:
  `rtk pnpm lint && rtk pnpm typecheck`

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

- Always: validate parsed numeric fields, bind v2 signatures to `tableId`,
  compare QR version with the database, require active/non-deleted records.
- Ask first: schema migrations, new dependencies, or ending legacy acceptance.
- Never: log signing keys/signatures, trust URL identity without a DB match, or
  silently accept an unknown signing format.

## Success Criteria

1. Newly generated table and seat URLs include `f=2` and `d={tableId}` and use
   canonical input
   `v2|{type}|{restaurantId}|{tableId}|{identifier}|{version}`.
2. Legacy URLs without `f`/`d` remain cryptographically verifiable during
   phase 1, but only when their identity and version match the active DB row.
3. Seat `01` on two different tables produces different signatures.
4. Regenerating a table or seat makes its previous QR fail DB-backed
   verification.
5. Public endpoints
   `GET /qr-codes/verify/table/:tableId?qrCode=...` and
   `GET /qr-codes/verify/seat/:seatId?qrCode=...` return only validated,
   minimal identity data.
6. Guest realtime token generation supports table and seat QR payloads and
   rejects cross-table, cross-seat, inactive, deleted, or stale-version codes.

## Open Questions

- Phase 2 bulk regeneration/printing and phase 3 legacy cutoff are intentionally
  outside this change and require an operational rollout date.
