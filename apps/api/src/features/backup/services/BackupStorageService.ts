/**
 * Backup Storage Service - Handles storage operations for backups
 */

import type { R2Bucket, KVNamespace } from "@cloudflare/workers-types";
import type { BackupRecord, StorageProvider } from "@makanmasak/shared-types";

export interface StorageMetadata {
  backup_id: string;
  restaurant_id: string;
  file_size: number;
  checksum: string;
  compression_enabled: boolean;
  encryption_enabled: boolean;
  created_at: string;
}

export class BackupStorageService {
  constructor(
    private r2Storage: R2Bucket,
    private kvStorage: KVNamespace,
  ) {}

  /**
   * Store backup data to the specified storage provider
   */
  async storeBackup(
    backup: BackupRecord,
    data: string,
    provider: StorageProvider = "r2",
  ): Promise<{ storage_path: string; checksum: string }> {
    try {
      const storagePath = this.generateStoragePath(
        backup.restaurant_id,
        backup.id,
      );
      const checksum = await this.calculateChecksum(data);

      const metadata: StorageMetadata = {
        backup_id: backup.id,
        restaurant_id: backup.restaurant_id,
        file_size: data.length,
        checksum,
        compression_enabled: backup.compression_enabled || false,
        encryption_enabled: backup.encryption_enabled || false,
        created_at: new Date().toISOString(),
      };

      switch (provider) {
        case "r2":
          await this.storeToR2(storagePath, data, metadata);
          break;
        case "kv":
          await this.storeToKV(backup.id, data, metadata);
          break;
        default:
          throw new Error(`Unsupported storage provider: ${provider}`);
      }

      return { storage_path: storagePath, checksum };
    } catch (error) {
      console.error("Error storing backup:", error);
      throw new Error(
        `Failed to store backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Retrieve backup data from storage
   */
  async retrieveBackup(backup: BackupRecord): Promise<string> {
    try {
      let data: string;

      switch (backup.storage_provider) {
        case "r2":
          data = await this.retrieveFromR2(backup.storage_path);
          break;
        case "kv":
          data = await this.retrieveFromKV(backup.id);
          break;
        default:
          throw new Error(
            `Unsupported storage provider: ${backup.storage_provider}`,
          );
      }

      // Verify checksum if available
      if (backup.checksum) {
        const calculatedChecksum = await this.calculateChecksum(data);
        if (calculatedChecksum !== backup.checksum) {
          throw new Error(
            "Backup data integrity check failed - checksum mismatch",
          );
        }
      }

      return data;
    } catch (error) {
      console.error("Error retrieving backup:", error);
      throw new Error(
        `Failed to retrieve backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete backup data from storage
   */
  async deleteBackup(backup: BackupRecord): Promise<void> {
    try {
      switch (backup.storage_provider) {
        case "r2":
          await this.deleteFromR2(backup.storage_path);
          break;
        case "kv":
          await this.deleteFromKV(backup.id);
          break;
        default:
          throw new Error(
            `Unsupported storage provider: ${backup.storage_provider}`,
          );
      }
    } catch (error) {
      console.error("Error deleting backup:", error);
      throw new Error(
        `Failed to delete backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Check if backup exists in storage
   */
  async backupExists(backup: BackupRecord): Promise<boolean> {
    try {
      switch (backup.storage_provider) {
        case "r2":
          return await this.existsInR2(backup.storage_path);
        case "kv":
          return await this.existsInKV(backup.id);
        default:
          return false;
      }
    } catch (error) {
      console.error("Error checking backup existence:", error);
      return false;
    }
  }

  /**
   * Get storage usage statistics for a restaurant
   */
  async getStorageUsage(restaurantId: string): Promise<{
    total_files: number;
    total_size_bytes: number;
    r2_files: number;
    r2_size_bytes: number;
    kv_files: number;
    kv_size_bytes: number;
  }> {
    try {
      // For R2, we can list objects with the restaurant prefix
      const r2Objects = await this.r2Storage.list({
        prefix: `backups/${restaurantId}/`,
      });

      let r2Files = 0;
      let r2SizeBytes = 0;

      for (const object of r2Objects.objects) {
        r2Files++;
        r2SizeBytes += object.size;
      }

      // For KV, we need to track this separately (KV doesn't have listing by prefix)
      // This would typically be tracked in the database
      const kvFiles = 0;
      const kvSizeBytes = 0;

      return {
        total_files: r2Files + kvFiles,
        total_size_bytes: r2SizeBytes + kvSizeBytes,
        r2_files: r2Files,
        r2_size_bytes: r2SizeBytes,
        kv_files: kvFiles,
        kv_size_bytes: kvSizeBytes,
      };
    } catch (error) {
      console.error("Error getting storage usage:", error);
      throw new Error("Failed to get storage usage statistics");
    }
  }

  /**
   * Cleanup expired backups from storage
   */
  async cleanupExpiredBackups(
    restaurantId: string,
    expiredBackups: BackupRecord[],
  ): Promise<number> {
    let cleanedCount = 0;

    for (const backup of expiredBackups) {
      try {
        await this.deleteBackup(backup);
        cleanedCount++;
        console.log(`Cleaned up expired backup: ${backup.id}`);
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }

    return cleanedCount;
  }

  // Private methods for R2 operations

  private async storeToR2(
    path: string,
    data: string,
    metadata: StorageMetadata,
  ): Promise<void> {
    await this.r2Storage.put(path, data, {
      customMetadata: {
        "backup-id": metadata.backup_id,
        "restaurant-id": metadata.restaurant_id,
        "file-size": metadata.file_size.toString(),
        checksum: metadata.checksum,
        "compression-enabled": metadata.compression_enabled.toString(),
        "encryption-enabled": metadata.encryption_enabled.toString(),
        "created-at": metadata.created_at,
      },
    });
  }

  private async retrieveFromR2(path: string): Promise<string> {
    const object = await this.r2Storage.get(path);
    if (!object) {
      throw new Error("Backup file not found in R2 storage");
    }
    return await object.text();
  }

  private async deleteFromR2(path: string): Promise<void> {
    await this.r2Storage.delete(path);
  }

  private async existsInR2(path: string): Promise<boolean> {
    const object = await this.r2Storage.head(path);
    return object !== null;
  }

  // Private methods for KV operations

  private async storeToKV(
    backupId: string,
    data: string,
    metadata: StorageMetadata,
  ): Promise<void> {
    const key = `backup:${backupId}`;
    await this.kvStorage.put(key, data, {
      metadata: {
        backup_id: metadata.backup_id,
        restaurant_id: metadata.restaurant_id,
        file_size: metadata.file_size,
        checksum: metadata.checksum,
        compression_enabled: metadata.compression_enabled,
        encryption_enabled: metadata.encryption_enabled,
        created_at: metadata.created_at,
      },
    });
  }

  private async retrieveFromKV(backupId: string): Promise<string> {
    const key = `backup:${backupId}`;
    const data = await this.kvStorage.get(key);
    if (!data) {
      throw new Error("Backup file not found in KV storage");
    }
    return data;
  }

  private async deleteFromKV(backupId: string): Promise<void> {
    const key = `backup:${backupId}`;
    await this.kvStorage.delete(key);
  }

  private async existsInKV(backupId: string): Promise<boolean> {
    const key = `backup:${backupId}`;
    const metadata = await this.kvStorage.getWithMetadata(key);
    return metadata.value !== null;
  }

  // Utility methods

  private generateStoragePath(restaurantId: string, backupId: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `backups/${restaurantId}/${date}/${backupId}.json`;
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ============================================================================
  // Compression Methods (using Web Streams API)
  // ============================================================================

  /**
   * 壓縮資料 (使用 gzip)
   * 使用 Web Streams API 的 CompressionStream，相容 Cloudflare Workers
   */
  private async compressData(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const inputData = encoder.encode(data);

      // 創建壓縮串流
      const stream = new Blob([inputData])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));

      // 讀取壓縮後的資料
      const compressedBuffer = await new Response(stream).arrayBuffer();
      const compressedArray = new Uint8Array(compressedBuffer);

      // 轉換為 base64 以便儲存
      return this.arrayBufferToBase64(compressedArray);
    } catch (error) {
      console.error("Compression failed:", error);
      throw new Error("Failed to compress backup data");
    }
  }

  /**
   * 解壓縮資料
   */
  private async decompressData(compressedData: string): Promise<string> {
    try {
      // 從 base64 還原
      const compressedArray = this.base64ToArrayBuffer(compressedData);

      // 創建解壓縮串流
      const stream = new Blob([compressedArray])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));

      // 讀取解壓縮後的資料
      return await new Response(stream).text();
    } catch (error) {
      console.error("Decompression failed:", error);
      throw new Error("Failed to decompress backup data");
    }
  }

  // ============================================================================
  // Encryption Methods (using Web Crypto API - AES-256-GCM)
  // ============================================================================

  /**
   * 加密資料 (AES-256-GCM)
   * 返回格式: base64(iv + encrypted_data)
   */
  private async encryptData(data: string, keyString: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // 從密鑰字串衍生加密金鑰
      const key = await this.deriveKey(keyString);

      // 生成隨機 IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 加密
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        dataBuffer,
      );

      // 合併 IV + 加密資料
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const combined = new Uint8Array(iv.length + encryptedArray.length);
      combined.set(iv, 0);
      combined.set(encryptedArray, iv.length);

      // 轉換為 base64
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      console.error("Encryption failed:", error);
      throw new Error("Failed to encrypt backup data");
    }
  }

  /**
   * 解密資料
   */
  private async decryptData(
    encryptedData: string,
    keyString: string,
  ): Promise<string> {
    try {
      // 從 base64 還原
      const combined = this.base64ToArrayBuffer(encryptedData);

      // 提取 IV (前 12 bytes)
      const iv = combined.slice(0, 12);
      const encryptedBuffer = combined.slice(12);

      // 從密鑰字串衍生加密金鑰
      const key = await this.deriveKey(keyString);

      // 解密
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedBuffer,
      );

      // 轉換為字串
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt backup data");
    }
  }

  /**
   * 從密鑰字串衍生 AES-256 金鑰 (PBKDF2)
   */
  private async deriveKey(keyString: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(keyString),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"],
    );

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("makanmasak-backup-salt-v1"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  // ============================================================================
  // Encoding Utilities
  // ============================================================================

  /**
   * ArrayBuffer 轉 Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 轉 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ============================================================================
  // High-Level Methods for Secure Backup
  // ============================================================================

  /**
   * 處理資料（壓縮 + 加密）
   * @param data 原始資料
   * @param compress 是否壓縮
   * @param encrypt 是否加密
   * @param encryptionKey 加密金鑰 (encrypt=true 時必須提供)
   */
  async processDataForStorage(
    data: string,
    compress: boolean,
    encrypt: boolean,
    encryptionKey?: string,
  ): Promise<{
    processedData: string;
    originalSize: number;
    processedSize: number;
  }> {
    const originalSize = new Blob([data]).size;
    let processedData = data;

    // 先壓縮
    if (compress) {
      processedData = await this.compressData(processedData);
    }

    // 再加密
    if (encrypt) {
      if (!encryptionKey) {
        throw new Error(
          "Encryption key is required when encryption is enabled",
        );
      }
      processedData = await this.encryptData(processedData, encryptionKey);
    }

    const processedSize = new Blob([processedData]).size;

    return { processedData, originalSize, processedSize };
  }

  /**
   * 還原資料（解密 + 解壓縮）
   * @param data 處理過的資料
   * @param wasCompressed 是否已壓縮
   * @param wasEncrypted 是否已加密
   * @param encryptionKey 加密金鑰 (wasEncrypted=true 時必須提供)
   */
  async processDataFromStorage(
    data: string,
    wasCompressed: boolean,
    wasEncrypted: boolean,
    encryptionKey?: string,
  ): Promise<string> {
    let processedData = data;

    // 先解密
    if (wasEncrypted) {
      if (!encryptionKey) {
        throw new Error("Encryption key is required when decryption is needed");
      }
      processedData = await this.decryptData(processedData, encryptionKey);
    }

    // 再解壓縮
    if (wasCompressed) {
      processedData = await this.decompressData(processedData);
    }

    return processedData;
  }

  /**
   * Generate download response for backup
   */
  async generateDownloadResponse(backup: BackupRecord): Promise<Response> {
    try {
      const data = await this.retrieveBackup(backup);
      const fileName = `${backup.name}_${backup.started_at.replace(/[:.]/g, "-")}.json`;

      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length": data.length.toString(),
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Error generating download response:", error);
      throw new Error("Failed to generate download response");
    }
  }
}
