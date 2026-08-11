import { ApiError } from "@makanmasak/utils";
import { WaitingStatus } from "@makanmasak/shared-types";

// `called → seated` is intentional: WaitingListService.markSeated accepts
// both `called` and `confirmed` as preconditions. Callers may skip the
// explicit confirm step when a customer just walks in after being called.
export const WAITING_TRANSITIONS = {
  [WaitingStatus.WAITING]: [
    WaitingStatus.CALLED,
    WaitingStatus.CANCELLED,
    WaitingStatus.EXPIRED,
  ],
  [WaitingStatus.CALLED]: [
    WaitingStatus.CONFIRMED,
    WaitingStatus.SEATED,
    WaitingStatus.CANCELLED,
    WaitingStatus.EXPIRED,
  ],
  [WaitingStatus.CONFIRMED]: [
    WaitingStatus.SEATED,
    WaitingStatus.CANCELLED,
    WaitingStatus.EXPIRED,
  ],
  [WaitingStatus.SEATED]: [],
  [WaitingStatus.CANCELLED]: [],
  [WaitingStatus.EXPIRED]: [],
  [WaitingStatus.NO_SHOW]: [],
} as const satisfies Record<WaitingStatus, readonly WaitingStatus[]>;

export function isValidWaitingTransition(
  from: WaitingStatus,
  to: WaitingStatus,
): boolean {
  const allowed = WAITING_TRANSITIONS[from] as readonly WaitingStatus[];
  return allowed.includes(to);
}

export function assertWaitingTransition(
  from: WaitingStatus,
  to: WaitingStatus,
): void {
  if (!isValidWaitingTransition(from, to)) {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition waiting list ticket from "${from}" to "${to}"`,
      409,
    );
  }
}
