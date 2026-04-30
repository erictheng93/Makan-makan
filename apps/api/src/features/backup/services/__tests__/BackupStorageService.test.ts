/**
 * BackupStorageService Tests
 * 備份儲存服務測試 — R2 / KV 操作、校驗碼、存取
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BackupStorageService } from "../BackupStorageService";
import type { BackupRecord } from "@makanmakan/shared-types";

// ========================================
// Mock crypto.subtle for checksum calculation
// ========================================

const MOCK_HASH = new Uint8Array([
  0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89,
]);

vi.stubGlobal("crypto", {
  ...(globalThis as typeof globalThis & { crypto: Crypto }).crypto,
  subtle: {
    digest: vi.fn().mockResolvedValue(MOCK_HASH.buffer),
    importKey: vi.fn().mockResolvedValue("mock-key-material"),
    deriveKey: vi.fn().mockResolvedValue("mock-derived-key"),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
    decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode("decrypted")),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    arr.fill(0x42);
    return arr;
  }),
});

// ========================================
// Mock R2 and KV
// ========================================

const mockR2Object = {
  text: vi.fn().mockResolvedValue('{"data":"backup-content"}'),
  size: 1024,
};

const mockR2Storage = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(mockR2Object),
  delete: vi.fn().mockResolvedValue(undefined),
  head: vi.fn().mockResolvedValue({ size: 1024 }),
  list: vi.fn().mockResolvedValue({
    objects: [
      { key: "backups/rest-1/2024-01-01/b1.json", size: 500 },
      { key: "backups/rest-1/2024-01-01/b2.json", size: 300 },
    ],
  }),
};

const mockKVStorage = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue('{"data":"kv-backup"}'),
  delete: vi.fn().mockResolvedValue(undefined),
  getWithMetadata: vi.fn().mockResolvedValue({ value: "data", metadata: {} }),
};

// ========================================
// Test Helpers
// ========================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const buildBackupRecord = (
  overrides: Partial<BackupRecord> = {},
): BackupRecord =>
  ({
    id: VALID_UUID,
    restaurant_id: VALID_UUID,
    name: "Test Backup",
    storage_provider: "r2",
    storage_path: `backups/${VALID_UUID}/2024-01-01/${VALID_UUID}.json`,
    status: "completed",
    compression_enabled: false,
    encryption_enabled: false,
    started_at: "2024-01-01T00:00:00.000Z",
    checksum: undefined,
    ...overrides,
  }) as BackupRecord;

// ========================================
// Tests
// ========================================

describe("BackupStorageService", () => {
  let service: BackupStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BackupStorageService(
      mockR2Storage as never,
      mockKVStorage as never,
    );
  });

  // ========================================
  // storeBackup
  // ========================================

  describe("storeBackup - 儲存備份", () => {
    it("should store backup to R2 with metadata", async () => {
      const backup = buildBackupRecord();
      const data = '{"orders":[]}';

      const result = await service.storeBackup(backup, data, "r2");

      expect(result).toEqual(
        expect.objectContaining({
          storage_path: expect.stringContaining(`backups/${VALID_UUID}/`),
          checksum: expect.any(String),
        }),
      );
      expect(mockR2Storage.put).toHaveBeenCalledOnce();
      expect(mockR2Storage.put).toHaveBeenCalledWith(
        expect.stringContaining("backups/"),
        data,
        expect.objectContaining({
          customMetadata: expect.objectContaining({
            "backup-id": VALID_UUID,
            "restaurant-id": VALID_UUID,
          }),
        }),
      );
    });

    it("should store backup to KV when provider is kv", async () => {
      const backup = buildBackupRecord();
      const data = '{"orders":[]}';

      const result = await service.storeBackup(backup, data, "kv");

      expect(result).toEqual(
        expect.objectContaining({
          checksum: expect.any(String),
        }),
      );
      expect(mockKVStorage.put).toHaveBeenCalledOnce();
      expect(mockKVStorage.put).toHaveBeenCalledWith(
        `backup:${VALID_UUID}`,
        data,
        expect.objectContaining({
          metadata: expect.objectContaining({
            backup_id: VALID_UUID,
          }),
        }),
      );
    });

    it("should throw for unsupported storage provider", async () => {
      const backup = buildBackupRecord();

      await expect(
        service.storeBackup(backup, "data", "azure" as never),
      ).rejects.toThrow("Failed to store backup");
    });
  });

  // ========================================
  // retrieveBackup
  // ========================================

  describe("retrieveBackup - 取得備份", () => {
    it("should retrieve backup from R2", async () => {
      const backup = buildBackupRecord({ storage_provider: "r2" });

      const result = await service.retrieveBackup(backup);

      expect(result).toBe('{"data":"backup-content"}');
      expect(mockR2Storage.get).toHaveBeenCalledWith(backup.storage_path);
    });

    it("should retrieve backup from KV", async () => {
      const backup = buildBackupRecord({ storage_provider: "kv" });

      const result = await service.retrieveBackup(backup);

      expect(result).toBe('{"data":"kv-backup"}');
      expect(mockKVStorage.get).toHaveBeenCalledWith(`backup:${VALID_UUID}`);
    });

    it("should throw when R2 object not found", async () => {
      mockR2Storage.get.mockResolvedValueOnce(null);
      const backup = buildBackupRecord({ storage_provider: "r2" });

      await expect(service.retrieveBackup(backup)).rejects.toThrow(
        "Failed to retrieve backup",
      );
    });

    it("should throw when KV data not found", async () => {
      mockKVStorage.get.mockResolvedValueOnce(null);
      const backup = buildBackupRecord({ storage_provider: "kv" });

      await expect(service.retrieveBackup(backup)).rejects.toThrow(
        "Failed to retrieve backup",
      );
    });

    it("should verify checksum and throw on mismatch", async () => {
      const backup = buildBackupRecord({
        storage_provider: "r2",
        checksum: "definitely-wrong-checksum",
      });

      await expect(service.retrieveBackup(backup)).rejects.toThrow(
        "Failed to retrieve backup",
      );
    });

    it("should throw for unsupported storage provider on retrieve", async () => {
      const backup = buildBackupRecord({ storage_provider: "gcs" as never });

      await expect(service.retrieveBackup(backup)).rejects.toThrow(
        "Failed to retrieve backup",
      );
    });
  });

  // ========================================
  // deleteBackup
  // ========================================

  describe("deleteBackup - 刪除備份", () => {
    it("should delete from R2", async () => {
      const backup = buildBackupRecord({ storage_provider: "r2" });

      await service.deleteBackup(backup);

      expect(mockR2Storage.delete).toHaveBeenCalledWith(backup.storage_path);
    });

    it("should delete from KV", async () => {
      const backup = buildBackupRecord({ storage_provider: "kv" });

      await service.deleteBackup(backup);

      expect(mockKVStorage.delete).toHaveBeenCalledWith(`backup:${VALID_UUID}`);
    });

    it("should throw for unsupported provider", async () => {
      const backup = buildBackupRecord({ storage_provider: "azure" as never });

      await expect(service.deleteBackup(backup)).rejects.toThrow(
        "Failed to delete backup",
      );
    });
  });

  // ========================================
  // backupExists
  // ========================================

  describe("backupExists - 檢查備份是否存在", () => {
    it("should return true when R2 object exists", async () => {
      const backup = buildBackupRecord({ storage_provider: "r2" });

      const exists = await service.backupExists(backup);

      expect(exists).toBe(true);
      expect(mockR2Storage.head).toHaveBeenCalledWith(backup.storage_path);
    });

    it("should return false when R2 object does not exist", async () => {
      mockR2Storage.head.mockResolvedValueOnce(null);
      const backup = buildBackupRecord({ storage_provider: "r2" });

      const exists = await service.backupExists(backup);
      expect(exists).toBe(false);
    });

    it("should return true when KV key exists", async () => {
      const backup = buildBackupRecord({ storage_provider: "kv" });

      const exists = await service.backupExists(backup);
      expect(exists).toBe(true);
    });

    it("should return false when KV key does not exist", async () => {
      mockKVStorage.getWithMetadata.mockResolvedValueOnce({
        value: null,
        metadata: null,
      });
      const backup = buildBackupRecord({ storage_provider: "kv" });

      const exists = await service.backupExists(backup);
      expect(exists).toBe(false);
    });

    it("should return false for unsupported provider", async () => {
      const backup = buildBackupRecord({ storage_provider: "s3" as never });

      const exists = await service.backupExists(backup);
      expect(exists).toBe(false);
    });

    it("should return false on error", async () => {
      mockR2Storage.head.mockRejectedValueOnce(new Error("Network error"));
      const backup = buildBackupRecord({ storage_provider: "r2" });

      const exists = await service.backupExists(backup);
      expect(exists).toBe(false);
    });
  });

  // ========================================
  // getStorageUsage
  // ========================================

  describe("getStorageUsage - 儲存使用統計", () => {
    it("should return storage usage for a restaurant", async () => {
      const usage = await service.getStorageUsage(VALID_UUID);

      expect(usage).toEqual(
        expect.objectContaining({
          total_files: 2,
          total_size_bytes: 800,
          r2_files: 2,
          r2_size_bytes: 800,
          kv_files: 0,
          kv_size_bytes: 0,
        }),
      );
      expect(mockR2Storage.list).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: `backups/${VALID_UUID}/`,
        }),
      );
    });

    it("should return zeros when no objects exist", async () => {
      mockR2Storage.list.mockResolvedValueOnce({ objects: [] });

      const usage = await service.getStorageUsage(VALID_UUID);

      expect(usage.total_files).toBe(0);
      expect(usage.total_size_bytes).toBe(0);
    });

    it("should throw on R2 list failure", async () => {
      mockR2Storage.list.mockRejectedValueOnce(new Error("R2 down"));

      await expect(service.getStorageUsage(VALID_UUID)).rejects.toThrow(
        "Failed to get storage usage statistics",
      );
    });
  });

  // ========================================
  // cleanupExpiredBackups
  // ========================================

  describe("cleanupExpiredBackups - 清除過期備份", () => {
    it("should delete all expired backups and return count", async () => {
      const expired = [
        buildBackupRecord({ id: "b1" }),
        buildBackupRecord({ id: "b2" }),
        buildBackupRecord({ id: "b3" }),
      ];

      const count = await service.cleanupExpiredBackups(VALID_UUID, expired);

      expect(count).toBe(3);
      expect(mockR2Storage.delete).toHaveBeenCalledTimes(3);
    });

    it("should return 0 for empty list", async () => {
      const count = await service.cleanupExpiredBackups(VALID_UUID, []);
      expect(count).toBe(0);
    });

    it("should continue cleanup even if individual deletes fail", async () => {
      mockR2Storage.delete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Delete failed"))
        .mockResolvedValueOnce(undefined);

      const expired = [
        buildBackupRecord({ id: "b1" }),
        buildBackupRecord({ id: "b2" }),
        buildBackupRecord({ id: "b3" }),
      ];

      const count = await service.cleanupExpiredBackups(VALID_UUID, expired);

      // 2 succeeded, 1 failed
      expect(count).toBe(2);
      expect(mockR2Storage.delete).toHaveBeenCalledTimes(3);
    });
  });

  // ========================================
  // processDataForStorage
  // ========================================

  describe("processDataForStorage - 資料處理（壓縮/加密）", () => {
    it("should return data unchanged when no compression or encryption", async () => {
      const result = await service.processDataForStorage(
        "raw data",
        false,
        false,
      );

      expect(result).toEqual(
        expect.objectContaining({
          processedData: "raw data",
          originalSize: expect.any(Number),
          processedSize: expect.any(Number),
        }),
      );
    });

    it("should throw when encryption is enabled but no key provided", async () => {
      await expect(
        service.processDataForStorage("data", false, true),
      ).rejects.toThrow(
        "Encryption key is required when encryption is enabled",
      );
    });
  });

  // ========================================
  // processDataFromStorage
  // ========================================

  describe("processDataFromStorage - 資料還原（解密/解壓）", () => {
    it("should return data unchanged when not compressed/encrypted", async () => {
      const result = await service.processDataFromStorage(
        "raw data",
        false,
        false,
      );
      expect(result).toBe("raw data");
    });

    it("should throw when decryption needed but no key provided", async () => {
      await expect(
        service.processDataFromStorage("data", false, true),
      ).rejects.toThrow("Encryption key is required when decryption is needed");
    });
  });

  // ========================================
  // generateDownloadResponse
  // ========================================

  describe("generateDownloadResponse - 產生下載回應", () => {
    it("should return a Response with correct headers", async () => {
      const backup = buildBackupRecord({
        name: "MyBackup",
        started_at: "2024-01-15T10:30:00.000Z",
      });

      const response = await service.generateDownloadResponse(backup);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Content-Disposition")).toContain("MyBackup");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
    });

    it("should throw when backup retrieval fails", async () => {
      mockR2Storage.get.mockResolvedValueOnce(null);
      const backup = buildBackupRecord();

      await expect(service.generateDownloadResponse(backup)).rejects.toThrow(
        "Failed to generate download response",
      );
    });
  });
});
