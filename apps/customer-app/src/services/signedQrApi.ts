import { apiClient } from "./api";

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
  verify(
    type: "table" | "seat",
    qrCode: string,
  ): Promise<SignedQrVerification> {
    return apiClient.get(`/qr/verify/${type}`, { qrCode });
  },
};
