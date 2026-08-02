import { computed } from "vue";
import { useRoute } from "vue-router";

function firstQueryValue(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

/**
 * Seat identity carried in the menu/cart route query after a seat QR resolves.
 *
 * Two distinct values, deliberately not interchangeable:
 *
 * - `seatId` is the `seats` row id. It is what the order payload needs, and it
 *   is meaningless to a diner.
 * - `seatNumber` is the label printed on the seat sticker ("02"). It is the
 *   only value safe to show, because it is the one the diner can compare
 *   against what is in front of them.
 *
 * `seats.id` is globally auto-incremented, so it matches `seat_number` only on
 * the very first table and diverges after that — seat "02" on the second table
 * is row 10. Deriving the display label from the id therefore showed a number
 * matching no sticker in the venue, which defeats the point of showing it at
 * all (catching a mis-scan) and is worse than showing nothing.
 *
 * When `seatNumber` is absent (someone typed the URL by hand, or an older link)
 * the label is null and callers must omit the seat entirely rather than
 * inventing one from the id.
 */
export function useSeatContext() {
  const route = useRoute();

  const seatId = computed<number | null>(() => {
    const parsed = Number(firstQueryValue(route.query.seatId));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  const seatNumber = computed<string | null>(
    () => firstQueryValue(route.query.seatNumber) ?? null,
  );

  // Only meaningful when both are present: the id drives the order, the number
  // is what we are allowed to render next to it.
  const seatLabel = computed<string | null>(() =>
    seatId.value !== null ? seatNumber.value : null,
  );

  /** Query fragment that keeps seat identity across in-app navigation. */
  const seatQuery = computed<Record<string, string> | undefined>(() => {
    if (seatId.value === null) return undefined;

    const query: Record<string, string> = { seatId: String(seatId.value) };
    if (seatNumber.value) {
      query.seatNumber = seatNumber.value;
    }
    return query;
  });

  return { seatId, seatNumber, seatLabel, seatQuery };
}
