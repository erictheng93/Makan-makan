import { sign, verify } from "jsonwebtoken";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, or } from "drizzle-orm";
import { orders, restaurants, seats, tables } from "@makanmakan/database";
import { parseSignedQRUrl, verifyQRSignature } from "@makanmakan/utils";
import type { Env } from "../../../shared/types";
import type { GuestTokenData } from "../../../middleware/guestAuth";
import { ConsoleLogger } from "../../../core/monitoring";
import type {
  GuestRealtimeTokenRequest,
  GuestRealtimeTokenResponse,
  RealtimeAuthPayload,
  RealtimeAuthTokenRequest,
  RealtimeAuthTokenResponse,
  RoomType,
} from "@makanmakan/shared-types";
import {
  TokenBlacklistService,
  type RevokeReason,
} from "./TokenBlacklistService";

export interface WebSocketTokenVerification {
  valid: boolean;
  payload?: RealtimeAuthPayload;
  error?: string;
  revoked?: boolean;
}

export class RealtimeAuthService {
  private db;
  private logger: ConsoleLogger;
  private env: Env;
  private realtimeJwtSecret: string;
  private blacklistService: TokenBlacklistService | null = null;

  constructor(env: Env) {
    this.env = env;
    this.db = drizzle(env.DB);
    this.logger = new ConsoleLogger("realtime-auth");
    this.realtimeJwtSecret = this.resolveRealtimeJwtSecret();

    if (!this.realtimeJwtSecret || this.realtimeJwtSecret.length < 32) {
      throw new Error(
        "REALTIME_JWT_SECRET must be set and at least 32 characters",
      );
    }

    const kvNamespace = (env as any).TOKEN_BLACKLIST || env.CACHE_KV;
    if (kvNamespace) {
      this.blacklistService = new TokenBlacklistService(kvNamespace);
    }
  }

  async generateWebSocketToken(
    request: RealtimeAuthTokenRequest,
  ): Promise<RealtimeAuthTokenResponse | { error: string }> {
    try {
      const { roomType, roomId, restaurantId, tableId, seatId, sessionId } =
        request;

      switch (roomType) {
        case "customer":
          if (tableId) {
            const tableExists = await this.verifyTableExists(
              tableId,
              restaurantId,
            );
            if (!tableExists) {
              return { error: "Invalid table ID" };
            }
          }
          if (seatId) {
            const seatExists = await this.verifySeatExists(
              seatId,
              restaurantId,
            );
            if (!seatExists) {
              return { error: "Invalid seat ID" };
            }
          }
          break;

        case "kitchen":
        case "admin":
        case "restaurant":
          if (!sessionId) {
            return { error: "Session ID required for this room type" };
          }
          break;

        default:
          return { error: "Invalid room type" };
      }

      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresIn = 5 * 60;
      const payload: RealtimeAuthPayload = {
        roomType,
        roomId,
        restaurantId,
        role: this.determineRole(roomType, sessionId),
        tableId,
        seatId,
        exp: issuedAt + expiresIn,
        iat: issuedAt,
      };

      const token = sign(payload, this.realtimeJwtSecret);
      const wsUrl = this.buildWebSocketUrl(roomType, roomId, token);

      return {
        token,
        expiresIn,
        wsUrl,
      };
    } catch (error) {
      this.logger.error("Failed to generate WebSocket token", error as Error);
      return { error: "Failed to generate token" };
    }
  }

  async generateGuestToken(
    request: GuestRealtimeTokenRequest,
  ): Promise<GuestRealtimeTokenResponse | { error: string }> {
    try {
      const validated = await this.validateGuestRealtimeRequest(request);
      if ("error" in validated) {
        return validated;
      }

      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + 15 * 60;
      const roomId = validated.orderId
        ? `order:${validated.orderId}`
        : `customer:${validated.table!.id}`;
      const payload: RealtimeAuthPayload = {
        roomType: "customer",
        roomId,
        restaurantId: validated.restaurant.id,
        role: "customer",
        guestFlag: true,
        exp: expiresAt,
        iat: issuedAt,
      };

      if (validated.orderId) {
        payload.scope = "guest-realtime";
        payload.orderId = validated.orderId;
      } else {
        payload.tableId = String(validated.table!.id);
      }

      const token = sign(payload, this.realtimeJwtSecret);
      const wsUrl = this.buildWebSocketUrl("customer", roomId, token);

      return {
        token,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        wsUrl,
      };
    } catch (error) {
      this.logger.error(
        "Failed to generate guest realtime token",
        error as Error,
      );
      return { error: "Failed to generate guest realtime token" };
    }
  }

  async verifyWebSocketToken(
    token: string,
  ): Promise<WebSocketTokenVerification> {
    try {
      if (this.blacklistService) {
        const isRevoked = await this.blacklistService.isTokenRevoked(token);
        if (isRevoked) {
          return {
            valid: false,
            error: "Token has been revoked",
            revoked: true,
          };
        }
      }

      const payload = verify(
        token,
        this.realtimeJwtSecret,
      ) as RealtimeAuthPayload;

      if (!payload.roomType || !payload.roomId || !payload.restaurantId) {
        return {
          valid: false,
          error: "Invalid token payload",
        };
      }

      if (payload.guestFlag) {
        const isScopedGuestRealtime =
          payload.scope === "guest-realtime" &&
          payload.roomType === "customer" &&
          payload.role === "customer" &&
          !!payload.orderId &&
          payload.roomId === `order:${payload.orderId}`;

        const isLegacyGuestRealtime =
          !payload.scope &&
          payload.roomType === "customer" &&
          payload.role === "customer" &&
          !!payload.tableId &&
          payload.roomId === `customer:${payload.tableId}`;

        if (!isScopedGuestRealtime && !isLegacyGuestRealtime) {
          return {
            valid: false,
            error: "Invalid guest token payload",
          };
        }
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          error: "Token expired",
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      this.logger.error("Token verification failed", error as Error);

      if (error instanceof Error) {
        if (error.name === "TokenExpiredError") {
          return { valid: false, error: "Token expired" };
        }
        if (error.name === "JsonWebTokenError") {
          return { valid: false, error: "Invalid token" };
        }
      }

      return {
        valid: false,
        error: "Token verification failed",
      };
    }
  }

  verifyChannelAccess(
    payload: RealtimeAuthPayload,
    channel: string,
  ): { allowed: boolean; error?: string } {
    if (payload.scope !== "guest-realtime") {
      return { allowed: true };
    }

    if (!payload.orderId) {
      return { allowed: false, error: "Invalid guest token payload" };
    }

    const expectedChannel = `order:${payload.orderId}`;
    if (channel !== expectedChannel) {
      return { allowed: false, error: "Token is not scoped to this channel" };
    }

    return { allowed: true };
  }

  async revokeToken(
    token: string,
    reason: RevokeReason,
    revokedBy?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.blacklistService) {
      return {
        success: false,
        error: "Token blacklist service not available",
      };
    }

    try {
      await this.blacklistService.revokeToken(token, reason, {
        revokedBy,
      });
      return { success: true };
    } catch (error) {
      this.logger.error("Failed to revoke token", error as Error);
      return {
        success: false,
        error: "Failed to revoke token",
      };
    }
  }

  async revokeUserTokens(
    userId: string,
    reason: RevokeReason,
    revokedBy?: string,
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!this.blacklistService) {
      return {
        success: false,
        error: "Token blacklist service not available",
      };
    }

    try {
      const result = await this.blacklistService.revokeUserTokens(
        userId,
        reason,
        revokedBy,
      );
      return { success: true, count: result.count };
    } catch (error) {
      this.logger.error("Failed to revoke user tokens", error as Error);
      return {
        success: false,
        error: "Failed to revoke user tokens",
      };
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    if (!this.blacklistService) {
      return false;
    }

    return this.blacklistService.isTokenRevoked(token);
  }

  async getBlacklistStats(): Promise<{
    available: boolean;
    estimatedCount?: number;
    sampleRecords?: unknown[];
  }> {
    if (!this.blacklistService) {
      return { available: false };
    }

    const stats = await this.blacklistService.getStats();
    return {
      available: true,
      ...stats,
    };
  }

  private async verifyTableExists(
    tableId: string,
    restaurantId: string,
  ): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            or(eq(tables.id, Number(tableId) || 0), eq(tables.qrCode, tableId)),
            eq(tables.restaurantId, restaurantId),
            eq(tables.isActive, true),
          ),
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.logger.error("Failed to verify table", error as Error);
      return false;
    }
  }

  private async verifySeatExists(
    seatId: string,
    restaurantId: string,
  ): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: seats.id })
        .from(seats)
        .innerJoin(tables, eq(seats.tableId, tables.id))
        .where(
          and(
            eq(seats.qrCode, seatId),
            eq(tables.restaurantId, restaurantId),
            eq(seats.isActive, true),
          ),
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.logger.error("Failed to verify seat", error as Error);
      return false;
    }
  }

  private determineRole(
    roomType: RoomType,
    _sessionId?: string,
  ): "customer" | "staff" | "admin" {
    if (roomType === "customer") {
      return "customer";
    }
    if (roomType === "kitchen") {
      return "staff";
    }
    if (roomType === "admin" || roomType === "restaurant") {
      return "admin";
    }
    return "customer";
  }

  private buildWebSocketUrl(
    roomType: RoomType,
    roomId: string,
    token: string,
  ): string {
    const baseUrl =
      this.env.REALTIME_WS_URL || "wss://realtime.makanmakan.workers.dev";
    return `${baseUrl}/${roomType}/${roomId}?token=${token}`;
  }

  private resolveRealtimeJwtSecret(): string {
    if (this.env.REALTIME_JWT_SECRET) {
      return this.env.REALTIME_JWT_SECRET;
    }

    if (this.env.NODE_ENV === "test") {
      return this.env.JWT_SECRET;
    }

    return "";
  }

  private async validateGuestRealtimeRequest(
    request: GuestRealtimeTokenRequest,
  ): Promise<
    | {
        restaurant: { id: string };
        table?: { id: number; restaurantId: string; number: string };
        orderId?: string;
      }
    | { error: string }
  > {
    if (request.guestToken) {
      const tokenData = (await this.env.CACHE_KV.get(
        `guest_token:${request.guestToken}`,
        "json",
      )) as GuestTokenData | null;

      if (!tokenData) {
        return { error: "Guest token expired or invalid" };
      }

      if (
        tokenData.orderId !== request.orderId ||
        tokenData.restaurantId !== request.restaurantId
      ) {
        return { error: "Guest token does not match this order" };
      }

      return {
        restaurant: { id: tokenData.restaurantId },
        orderId: tokenData.orderId,
      };
    }

    if (!request.qrCode || !request.tableId) {
      return { error: "A guest token or signed table QR code is required" };
    }

    const qrPayload = parseSignedQRUrl(request.qrCode);
    if (!qrPayload || qrPayload.type !== "table") {
      return { error: "A valid signed table QR code is required" };
    }

    const signingKey = this.env.QR_SIGNING_KEY || this.env.JWT_SECRET;
    const qrValid = await verifyQRSignature(
      {
        type: qrPayload.type,
        restaurantId: qrPayload.restaurantId,
        identifier: qrPayload.identifier,
        version: qrPayload.version,
      },
      qrPayload.signature,
      signingKey,
    );

    if (!qrValid) {
      return { error: "Invalid QR signature" };
    }

    if (qrPayload.restaurantId !== request.restaurantId) {
      return { error: "QR code does not match restaurant" };
    }

    const restaurantRows = await this.db
      .select({
        id: restaurants.id,
        settings: restaurants.settings,
        isActive: restaurants.isActive,
        isAvailable: restaurants.isAvailable,
      })
      .from(restaurants)
      .where(eq(restaurants.id, request.restaurantId))
      .limit(1);
    const restaurant = restaurantRows[0];

    if (!restaurant || restaurant.isActive !== true) {
      return { error: "Restaurant not found" };
    }

    const settings =
      (restaurant.settings as Record<string, unknown> | null) ?? {};
    if (restaurant.isAvailable !== true || settings.allowGuestOrders !== true) {
      return { error: "Guest realtime is not enabled for this restaurant" };
    }

    const tableRows = await this.db
      .select({
        id: tables.id,
        restaurantId: tables.restaurantId,
        number: tables.number,
        isActive: tables.isActive,
      })
      .from(tables)
      .where(
        and(
          eq(tables.id, Number(request.tableId)),
          eq(tables.restaurantId, request.restaurantId),
        ),
      )
      .limit(1);
    const table = tableRows[0];

    if (!table || table.isActive !== true) {
      return { error: "Table not found or inactive" };
    }

    if (table.number !== qrPayload.identifier) {
      return { error: "QR code does not match table" };
    }

    if (request.orderId) {
      const orderRows = await this.db
        .select({
          id: orders.id,
          restaurantId: orders.restaurantId,
          tableId: orders.tableId,
        })
        .from(orders)
        .where(eq(orders.id, Number(request.orderId)))
        .limit(1);
      const order = orderRows[0];

      if (
        !order ||
        order.restaurantId !== request.restaurantId ||
        String(order.tableId) !== String(table.id)
      ) {
        return { error: "Order does not belong to this table" };
      }
    }

    return {
      restaurant: { id: restaurant.id },
      table: {
        id: table.id,
        restaurantId: table.restaurantId,
        number: table.number,
      },
      orderId: request.orderId,
    };
  }
}
