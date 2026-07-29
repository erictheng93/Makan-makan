import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { seats, tables } from "@makanmakan/database";
import {
  parseSignedQRUrl,
  verifyQRSignature,
  type SignedQRUrlParams,
} from "@makanmakan/utils";
import type { Env } from "../../../shared/types";

type VerificationFailure = { valid: false };

export type TableQrVerification =
  | VerificationFailure
  | {
      valid: true;
      type: "table";
      restaurantId: string;
      tableId: number;
      tableNumber: string;
      formatVersion: 1 | 2;
    };

export type SeatQrVerification =
  | VerificationFailure
  | {
      valid: true;
      type: "seat";
      restaurantId: string;
      tableId: number;
      tableNumber: string;
      seatId: number;
      seatNumber: string;
      formatVersion: 1 | 2;
    };

export class SignedQrVerificationService {
  private readonly signingKey: string;

  constructor(
    env: Pick<Env, "DB" | "QR_SIGNING_KEY">,
    private readonly db = drizzle(env.DB),
  ) {
    if (!env.QR_SIGNING_KEY || env.QR_SIGNING_KEY.length < 32) {
      throw new Error("QR_SIGNING_KEY must be set and at least 32 characters");
    }
    this.signingKey = env.QR_SIGNING_KEY;
  }

  async verifyTable(
    qrCode: string,
    tableId?: number,
  ): Promise<TableQrVerification> {
    const payload = await this.parseAndVerify(qrCode, "table");
    if (!payload) return { valid: false };

    const resolvedTableId = tableId ?? payload.tableId;
    const [table] = await this.db
      .select({
        id: tables.id,
        restaurantId: tables.restaurantId,
        number: tables.number,
        qrCode: tables.qrCode,
        qrCodeVersion: tables.qrCodeVersion,
        isActive: tables.isActive,
        deletedAt: tables.deletedAt,
      })
      .from(tables)
      .where(
        resolvedTableId === undefined
          ? eq(tables.qrCode, qrCode)
          : eq(tables.id, resolvedTableId),
      )
      .limit(1);

    if (
      !table ||
      table.isActive !== true ||
      table.deletedAt !== null ||
      table.restaurantId !== payload.restaurantId ||
      table.number !== payload.identifier ||
      table.qrCodeVersion !== payload.version ||
      (payload.formatVersion === 1 && table.qrCode !== qrCode) ||
      (payload.formatVersion === 2 && payload.tableId !== table.id)
    ) {
      return { valid: false };
    }

    return {
      valid: true,
      type: "table",
      restaurantId: table.restaurantId,
      tableId: table.id,
      tableNumber: table.number,
      formatVersion: payload.formatVersion,
    };
  }

  async verifySeat(
    qrCode: string,
    seatId?: number,
  ): Promise<SeatQrVerification> {
    const payload = await this.parseAndVerify(qrCode, "seat");
    if (!payload) return { valid: false };

    const seatIdentity =
      seatId !== undefined
        ? eq(seats.id, seatId)
        : payload.formatVersion === 2 && payload.tableId !== undefined
          ? and(
              eq(seats.tableId, payload.tableId),
              eq(seats.seatNumber, payload.identifier),
            )
          : eq(seats.qrCode, qrCode);
    const [seat] = await this.db
      .select({
        id: seats.id,
        tableId: seats.tableId,
        seatNumber: seats.seatNumber,
        qrCode: seats.qrCode,
        qrCodeVersion: seats.qrCodeVersion,
        isActive: seats.isActive,
        deletedAt: seats.deletedAt,
        restaurantId: tables.restaurantId,
        tableNumber: tables.number,
        tableIsActive: tables.isActive,
        tableDeletedAt: tables.deletedAt,
      })
      .from(seats)
      .leftJoin(tables, eq(seats.tableId, tables.id))
      .where(seatIdentity)
      .limit(1);

    if (
      !seat ||
      seat.isActive !== true ||
      seat.deletedAt !== null ||
      seat.tableIsActive !== true ||
      seat.tableDeletedAt !== null ||
      seat.restaurantId === null ||
      seat.tableNumber === null ||
      seat.restaurantId !== payload.restaurantId ||
      seat.seatNumber !== payload.identifier ||
      seat.qrCodeVersion !== payload.version ||
      (payload.formatVersion === 1 && seat.qrCode !== qrCode) ||
      (payload.formatVersion === 2 && payload.tableId !== seat.tableId)
    ) {
      return { valid: false };
    }

    return {
      valid: true,
      type: "seat",
      restaurantId: seat.restaurantId,
      tableId: seat.tableId,
      tableNumber: seat.tableNumber,
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      formatVersion: payload.formatVersion,
    };
  }

  verifyTableFromQrCode(qrCode: string): Promise<TableQrVerification> {
    return this.verifyTable(qrCode);
  }

  verifySeatFromQrCode(qrCode: string): Promise<SeatQrVerification> {
    return this.verifySeat(qrCode);
  }

  private async parseAndVerify(
    qrCode: string,
    expectedType: "table" | "seat",
  ): Promise<SignedQRUrlParams | null> {
    const payload = parseSignedQRUrl(qrCode);
    if (!payload || payload.type !== expectedType) return null;

    const valid = await verifyQRSignature(
      payload,
      payload.signature,
      this.signingKey,
    );
    return valid ? payload : null;
  }
}
