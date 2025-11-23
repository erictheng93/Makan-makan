// Realtime - JWT Token Verification 測試
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sign } from 'jsonwebtoken';
import { verifyWebSocketToken, extractTokenFromUrl } from '../../../utils/jwtVerifier';
import type { RealtimeAuthPayload } from '@makanmakan/shared-types';

/**
 * JWT Token Verification 測試
 *
 * 測試範圍：
 * - Token 格式驗證
 * - Token 過期檢查
 * - Payload 欄位驗證
 * - 錯誤處理
 */

describe('JWT Token Verification', () => {
  const JWT_SECRET = 'test-secret-key-minimum-32-characters-long-for-security';

  // 創建有效的 test token
  const createValidToken = (overrides: Partial<RealtimeAuthPayload> = {}) => {
    const payload: RealtimeAuthPayload = {
      roomType: 'customer',
      roomId: 'table-123',
      restaurantId: 'rest-456',
      userId: 'user-789',
      role: 1, // Shop Owner
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      ...overrides,
    };

    return sign(payload, JWT_SECRET);
  };

  describe('verifyWebSocketToken()', () => {
    describe('成功場景', () => {
      it('應該成功驗證有效的 token', async () => {
        const token = createValidToken();

        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(true);
        expect(result.payload).toBeDefined();
        expect(result.payload?.roomType).toBe('customer');
        expect(result.payload?.roomId).toBe('table-123');
        expect(result.payload?.restaurantId).toBe('rest-456');
        expect(result.error).toBeUndefined();
      });

      it('應該正確解析所有必要欄位', async () => {
        const token = createValidToken({
          userId: 'custom-user-id',
          role: 2, // Chef
        });

        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(true);
        expect(result.payload?.userId).toBe('custom-user-id');
        expect(result.payload?.role).toBe(2);
      });

      it('應該接受包含額外欄位的 token', async () => {
        const payload: any = {
          roomType: 'admin',
          roomId: 'dashboard-1',
          restaurantId: 'rest-123',
          userId: 'admin-user',
          role: 0,
          customField: 'custom-value', // 額外欄位
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };

        const token = sign(payload, JWT_SECRET);
        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(true);
      });
    });

    describe('失敗場景 - Token 格式錯誤', () => {
      it('應該拒絕空 token', async () => {
        const result = await verifyWebSocketToken('', JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Token is required');
        expect(result.payload).toBeUndefined();
      });

      it('應該拒絕無效格式的 token', async () => {
        const invalidToken = 'invalid-token-format';

        const result = await verifyWebSocketToken(invalidToken, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });

      it('應該拒絕錯誤簽名的 token', async () => {
        const wrongSecret = 'wrong-secret-key-minimum-32-characters-long';
        const token = sign({ roomType: 'customer', roomId: 'table-1' }, wrongSecret);

        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid token format');
      });
    });

    describe('失敗場景 - Token 過期', () => {
      it('應該拒絕過期的 token', async () => {
        const expiredToken = createValidToken({
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        });

        const result = await verifyWebSocketToken(expiredToken, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Token has expired');
      });

      it('應該拒絕尚未生效的 token', async () => {
        const payload: any = {
          roomType: 'customer',
          roomId: 'table-123',
          restaurantId: 'rest-456',
          nbf: Math.floor(Date.now() / 1000) + 3600, // Not valid until 1 hour from now
          exp: Math.floor(Date.now() / 1000) + 7200,
        };

        const token = sign(payload, JWT_SECRET);
        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Token not yet valid');
      });
    });

    describe('失敗場景 - 缺少必要欄位', () => {
      it('應該拒絕缺少 roomType 的 token', async () => {
        const payload: any = {
          roomId: 'table-123',
          restaurantId: 'rest-456',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = sign(payload, JWT_SECRET);
        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid token payload: missing required fields');
      });

      it('應該拒絕缺少 roomId 的 token', async () => {
        const payload: any = {
          roomType: 'customer',
          restaurantId: 'rest-456',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = sign(payload, JWT_SECRET);
        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid token payload: missing required fields');
      });

      it('應該拒絕缺少 restaurantId 的 token', async () => {
        const payload: any = {
          roomType: 'customer',
          roomId: 'table-123',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = sign(payload, JWT_SECRET);
        const result = await verifyWebSocketToken(token, JWT_SECRET);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid token payload: missing required fields');
      });
    });

    describe('失敗場景 - JWT Secret 配置錯誤', () => {
      it('應該拒絕空的 JWT_SECRET', async () => {
        const token = createValidToken();

        const result = await verifyWebSocketToken(token, '');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Server configuration error');
      });

      it('應該拒絕過短的 JWT_SECRET', async () => {
        const token = createValidToken();
        const shortSecret = 'short'; // Less than 32 characters

        const result = await verifyWebSocketToken(token, shortSecret);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Server configuration error');
      });
    });

    describe('邊界條件', () => {
      it('應該正確處理即將過期的 token（1 秒內）', async () => {
        const almostExpiredToken = createValidToken({
          exp: Math.floor(Date.now() / 1000) + 1, // Expires in 1 second
        });

        const result = await verifyWebSocketToken(almostExpiredToken, JWT_SECRET);

        expect(result.valid).toBe(true);
      });

      it('應該正確處理剛剛簽發的 token', async () => {
        const freshToken = createValidToken({
          iat: Math.floor(Date.now() / 1000), // Issued now
        });

        const result = await verifyWebSocketToken(freshToken, JWT_SECRET);

        expect(result.valid).toBe(true);
      });

      it('應該處理非常長的過期時間', async () => {
        const longLivedToken = createValidToken({
          exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
        });

        const result = await verifyWebSocketToken(longLivedToken, JWT_SECRET);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('extractTokenFromUrl()', () => {
    it('應該從 URL 查詢參數中提取 token', () => {
      const url = new URL('ws://localhost:8787/customer/table-123?token=my-test-token');

      const token = extractTokenFromUrl(url);

      expect(token).toBe('my-test-token');
    });

    it('應該處理不包含 token 的 URL', () => {
      const url = new URL('ws://localhost:8787/customer/table-123');

      const token = extractTokenFromUrl(url);

      expect(token).toBeNull();
    });

    it('應該處理空的 token 參數', () => {
      const url = new URL('ws://localhost:8787/customer/table-123?token=');

      const token = extractTokenFromUrl(url);

      expect(token).toBe('');
    });

    it('應該處理包含多個查詢參數的 URL', () => {
      const url = new URL('ws://localhost:8787/customer/table-123?foo=bar&token=my-token&baz=qux');

      const token = extractTokenFromUrl(url);

      expect(token).toBe('my-token');
    });

    it('應該處理包含特殊字符的 token', () => {
      const specialToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const url = new URL(`ws://localhost:8787/customer/table-123?token=${encodeURIComponent(specialToken)}`);

      const token = extractTokenFromUrl(url);

      expect(token).toBe(specialToken);
    });
  });

  describe('整合測試', () => {
    it('應該完整驗證從 URL 提取的 token', async () => {
      const validToken = createValidToken();
      const url = new URL(`ws://localhost:8787/customer/table-123?token=${validToken}`);

      const extractedToken = extractTokenFromUrl(url);
      expect(extractedToken).toBe(validToken);

      const result = await verifyWebSocketToken(extractedToken!, JWT_SECRET);
      expect(result.valid).toBe(true);
    });

    it('應該拒絕從 URL 提取的無效 token', async () => {
      const invalidToken = 'invalid-token';
      const url = new URL(`ws://localhost:8787/customer/table-123?token=${invalidToken}`);

      const extractedToken = extractTokenFromUrl(url);
      const result = await verifyWebSocketToken(extractedToken!, JWT_SECRET);

      expect(result.valid).toBe(false);
    });
  });
});
