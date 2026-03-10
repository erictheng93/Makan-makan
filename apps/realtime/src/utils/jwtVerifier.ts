/**
 * JWT 驗證工具
 * 用於驗證 WebSocket 連線的 JWT token
 *
 * 功能:
 * - JWT 簽名驗證
 * - Token 過期檢查
 * - Token 黑名單檢查（使用 KV 存儲）
 */

import { verify } from "jsonwebtoken";
import type { RealtimeAuthPayload } from "@makanmakan/shared-types";

// KV key 前綴（與 TokenBlacklistService 保持一致）
const TOKEN_BLACKLIST_PREFIX = "token:revoked:";

export interface TokenVerificationResult {
  valid: boolean;
  payload?: RealtimeAuthPayload;
  error?: string;
  revoked?: boolean;
}

/**
 * 生成 token 的唯一標識（與 TokenBlacklistService 保持一致）
 */
function generateTokenId(token: string): string {
  if (token.length <= 40) {
    return token;
  }
  return `${token.substring(0, 32)}...${token.substring(token.length - 8)}`;
}

/**
 * 檢查 token 是否在黑名單中
 */
export async function isTokenRevoked(
  token: string,
  kv: KVNamespace | undefined,
): Promise<boolean> {
  if (!kv) {
    return false; // 如果沒有 KV，假設 token 未被撤銷
  }

  try {
    const tokenId = generateTokenId(token);
    const key = `${TOKEN_BLACKLIST_PREFIX}${tokenId}`;
    const record = await kv.get(key);
    return record !== null;
  } catch (error) {
    console.error("Failed to check token blacklist:", error);
    // 在錯誤情況下，為了安全起見，返回 true（視為已撤銷）
    return true;
  }
}

/**
 * 驗證 JWT token（包含黑名單檢查）
 */
export async function verifyWebSocketToken(
  token: string,
  jwtSecret: string,
  kv?: KVNamespace,
): Promise<TokenVerificationResult> {
  try {
    if (!token) {
      return {
        valid: false,
        error: "Token is required",
      };
    }

    if (!jwtSecret || jwtSecret.length < 32) {
      console.error("JWT_SECRET is not properly configured");
      return {
        valid: false,
        error: "Server configuration error",
      };
    }

    // 🔒 首先檢查 token 是否在黑名單中
    if (kv) {
      const revoked = await isTokenRevoked(token, kv);
      if (revoked) {
        console.warn("WebSocket token has been revoked");
        return {
          valid: false,
          error: "Token has been revoked",
          revoked: true,
        };
      }
    }

    // 驗證 JWT token
    const payload = verify(token, jwtSecret) as RealtimeAuthPayload;

    // 檢查必要欄位
    if (!payload.roomType || !payload.roomId || !payload.restaurantId) {
      return {
        valid: false,
        error: "Invalid token payload: missing required fields",
      };
    }

    // 檢查 token 是否過期（verify 已經會檢查，但我們再加一層保險）
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        error: "Token has expired",
      };
    }

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    console.error("Token verification error:", error);

    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        return { valid: false, error: "Token has expired" };
      }
      if (error.name === "JsonWebTokenError") {
        return { valid: false, error: "Invalid token format" };
      }
      if (error.name === "NotBeforeError") {
        return { valid: false, error: "Token not yet valid" };
      }
    }

    return {
      valid: false,
      error: "Token verification failed",
    };
  }
}

/**
 * 從 URL 查詢參數中提取 token
 */
export function extractTokenFromUrl(url: URL): string | null {
  return url.searchParams.get("token");
}
