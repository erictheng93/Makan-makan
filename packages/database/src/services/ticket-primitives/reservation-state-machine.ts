import { ReservationStatus } from "@makanmasak/shared-types";
import { ApiError } from "@makanmasak/utils";

// A guest may arrive without an explicit confirmation, just as a called
// waiting-list guest may be seated without an explicit confirmation.
export const RESERVATION_TRANSITIONS = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.ARRIVED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.ARRIVED,
    ReservationStatus.SEATED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.ARRIVED]: [
    ReservationStatus.SEATED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.SEATED]: [ReservationStatus.COMPLETED],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
} as const satisfies Record<ReservationStatus, readonly ReservationStatus[]>;

export function isValidReservationTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  const allowed = RESERVATION_TRANSITIONS[from] as readonly ReservationStatus[];
  return allowed.includes(to);
}

export function assertReservationTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): void {
  if (!isValidReservationTransition(from, to)) {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition reservation from "${from}" to "${to}"`,
      409,
    );
  }
}
