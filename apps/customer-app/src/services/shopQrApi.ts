import { apiClient } from "./api";

/**
 * Shop QR verification.
 *
 * Deliberately not folded into `signedQrApi`: table and seat codes carry an
 * HMAC signature and are not public, while a shop code is a public identifier
 * that `GET /restaurants/:id` and discovery both hand out on request. Verifying
 * one therefore proves nothing about who is holding it — see CLAUDE.md, "Shop
 * QR codes are public identifiers, not credentials".
 *
 * What it does answer is whether the sticker in someone's hand is still the
 * live one and whether the owner still has shop ordering switched on. Both are
 * revocation questions, and the server owns both rules (`verifyShopQrCode`
 * matches the current `shopQrCode` with `isActive` and `enableShopMode`), which
 * is why this asks rather than recomputing the comparison from the restaurant
 * payload the page already has.
 */
export interface ShopQrVerification {
  valid: boolean;
  restaurantId?: string;
}

function getApiErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function getApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

export const shopQrApi = {
  async verify(qrCode: string): Promise<ShopQrVerification> {
    try {
      const result = await apiClient.get<{
        valid: true;
        restaurantId: string;
      }>(`/qr/verify/shop/${encodeURIComponent(qrCode)}`);

      return { valid: true, restaurantId: result.restaurantId };
    } catch (error) {
      // A retired sticker, a shop that switched the channel off, and a `?qr=`
      // that is not a shop code at all are one verdict as far as the customer
      // is concerned: this link no longer gets them a menu. The first two come
      // back as `QR_CODE_INVALID`, the third fails param validation with 400.
      //
      // Anything else — offline, 5xx — is not a verdict. Rethrow so the caller
      // offers a retry instead of telling someone their valid code is dead.
      if (
        getApiErrorCode(error) === "QR_CODE_INVALID" ||
        getApiErrorStatus(error) === 400
      ) {
        return { valid: false };
      }

      throw error;
    }
  },
};
