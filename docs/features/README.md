# Features Documentation

This directory contains documentation for **active/in-progress** feature modules.

Completed feature documentation has been moved to [`docs/archive/completed-features/`](../archive/completed-features/).

---

## Active Features

### Realtime Services (`realtime-services/`)

WebSocket real-time communication via Durable Objects.

**Status**: 90% complete figure predates the 2026-06-13 `AdvancedRealtimeSession` removal (see archived doc below) — treat as stale until re-measured against the current `apps/realtime/src/durableObjects/RealtimeSession.ts`; Phase 4 (production readiness) pending

**Active docs**:

- `docs/archive/deprecated/REALTIME_SERVICES_IMPLEMENTATION.md` - superseded architecture doc (see banner); current implementation is `apps/realtime/src/index.ts` + `RealtimeSession.ts`
- `phases/REALTIME_PHASE4_PLAN.md` - Phase 4 plan (pending)
- `phases/REALTIME_PHASE4_KICKOFF.md` - Phase 4 kickoff notes

---

## Archived Features

The following completed features have documentation in [`docs/archive/completed-features/`](../archive/completed-features/):

| Feature                                  | Archive Location                                  |
| ---------------------------------------- | ------------------------------------------------- |
| AI Analytics                             | `archive/completed-features/ai-analytics/`        |
| Employee Management (Scheduling + Leave) | `archive/completed-features/employee-management/` |
| Partnership System                       | `archive/completed-features/partnership-system/`  |
| Shop QR System                           | `archive/completed-features/shop-qr/`             |
| Seat Management                          | `archive/completed-features/seat-management/`     |
| Password Security Migration              | `archive/completed-features/security/`            |
| Realtime Services Phase 1-3              | `archive/completed-features/realtime-services/`   |

---

**Last Updated**: 2026-03-16
