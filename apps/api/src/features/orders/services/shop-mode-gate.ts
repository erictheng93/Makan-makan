/**
 * Shop-mode gate for the customer ordering endpoints.
 *
 * `enableShopMode` is the owner's on/off switch for QR ordering, and until this
 * existed the only server-side place that consulted it on the customer path was
 * `GET /qr/verify/shop/:qrCode`. That endpoint is reached solely from the
 * pickup-digits screen, which shops that turn `requirePhone` off skip entirely —
 * so switching shop mode off left the order write itself unguarded.
 *
 * Applied at the two customer-facing entry points (`POST /orders`,
 * `POST /guest-orders`) rather than inside `OrdersService.createOrder`, because
 * `orderType: "shop"` is not by itself a shop-QR order:
 *
 * - `POST /orders` defaults `orderType` to `"shop"`, so a table order whose
 *   client omitted the field still arrives labelled that way.
 * - Market checkouts write child orders as `"shop"`; they are gated on market
 *   membership + `allowGuestOrders` in the checkout route.
 * - Group orders finalize non-dine-in carts as `"shop"`; that channel has its
 *   own lifecycle.
 *
 * None of those three are the shop QR channel this switch governs.
 */

import { RestaurantService } from "@makanmasak/database";
import { forbidden, notFound } from "../../../shared/utils/api-error";
import type { Env } from "../../../shared/types";

/**
 * Assert against an `enableShopMode` value the caller already has in hand.
 */
export function assertShopModeEnabled(enabled: boolean | null | undefined) {
  if (!enabled) {
    throw forbidden(
      "This restaurant is not accepting shop orders",
      "SHOP_MODE_DISABLED",
    );
  }
}

/**
 * Retire the previous sticker when an owner regenerates their shop QR code.
 *
 * Checked only when the client actually sends what it scanned. Requiring it
 * outright would reject every customer already mid-order on a client that
 * predates the field, and every entry point that legitimately has no code to
 * present (a waiting-list link, a bookmarked menu). So this closes the loop for
 * scans that carry a code and leaves the rest to `assertShopModeEnabled` —
 * regeneration takes effect for anyone scanning the old sticker, which is who
 * the owner is trying to turn away.
 */
export function assertShopQrCurrent(
  currentQrCode: string | null | undefined,
  scannedQrCode: string | null | undefined,
) {
  if (!scannedQrCode) {
    return;
  }

  if (scannedQrCode !== currentQrCode) {
    throw forbidden(
      "This QR code is no longer valid. Please scan the current one.",
      "SHOP_QR_REVOKED",
    );
  }
}

/**
 * Same assertions for callers that have not loaded the restaurant yet.
 */
export async function assertShopOrderingEnabled(
  env: Env,
  restaurantId: string,
  scannedQrCode?: string | null,
) {
  const restaurantService = new RestaurantService(env.DB, env);
  const state = await restaurantService.getShopOrderingState(restaurantId);

  if (state === null) {
    throw notFound("Restaurant not found", "RESTAURANT_NOT_FOUND");
  }

  assertShopModeEnabled(state.enableShopMode);
  assertShopQrCurrent(state.shopQrCode, scannedQrCode);
}
