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

export const signedQrApi = {
  async verify(
    type: "table" | "seat",
    qrCode: string,
  ): Promise<SignedQrVerification> {
    try {
      return await apiClient.get(`/qr/verify/${type}`, { qrCode });
    } catch {
      throw new Error(translate("toast.qrSignatureInvalid"));
    }
  },
};
