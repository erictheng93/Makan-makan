import { apiClient } from "./api";
import { translate } from "@/utils/i18n";

interface SignedQrVerificationBase {
  valid: true;
  restaurantId: string;
  tableId: number;
  tableNumber: string;
  formatVersion: 2;
}

export interface TableQrVerification extends SignedQrVerificationBase {
  type: "table";
}

export interface SeatQrVerification extends SignedQrVerificationBase {
  type: "seat";
  seatId: number;
  seatNumber: string;
}

export type SignedQrVerification = TableQrVerification | SeatQrVerification;

const qrSignatureInvalidCodes = new Set([
  "TABLE_QR_SIGNATURE_INVALID",
  "TABLE_QR_STALE",
  "SEAT_QR_SIGNATURE_INVALID",
  "SEAT_QR_STALE",
]);

function getApiErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function isSignedQrErrorCode(code: string): boolean {
  return code.startsWith("TABLE_QR_") || code.startsWith("SEAT_QR_");
}

export const signedQrApi = {
  async verify(
    type: "table" | "seat",
    qrCode: string,
  ): Promise<SignedQrVerification> {
    try {
      return await apiClient.get(`/qr/verify/${type}`, { qrCode });
    } catch (error) {
      console.warn("Signed QR verification failed:", error);

      const code = getApiErrorCode(error);

      if (code && qrSignatureInvalidCodes.has(code)) {
        throw new Error(translate("toast.qrSignatureInvalid"));
      }

      if (code && isSignedQrErrorCode(code)) {
        throw new Error(translate("toast.qrProcessError"));
      }

      throw new Error(translate("toast.qrProcessError"));
    }
  },
};
