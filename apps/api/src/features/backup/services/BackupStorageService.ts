/**
 * Backup Storage Service - Handles storage operations for backups
 */

import type { R2Bucket, KVNamespace } from '@cloudflare/workers-types'
import type { BackupRecord, StorageProvider } from '@makanmakan/shared-types'

export interface StorageMetadata {
  backup_id: string
  restaurant_id: string
  file_size: number
  checksum: string
  compression_enabled: boolean
  encryption_enabled: boolean
  created_at: string
}

export class BackupStorageService {
  constructor(
    private r2Storage: R2Bucket,
    private kvStorage: KVNamespace
  ) {}

  /**
   * Store backup data to the specified storage provider
   */
  async storeBackup(
    backup: BackupRecord,
    data: string,
    provider: StorageProvider = 'r2'
  ): Promise<{ storage_path: string; checksum: string }> {
    try {
      const storagePath = this.generateStoragePath(backup.restaurant_id, backup.id)
      const checksum = await this.calculateChecksum(data)

      const metadata: StorageMetadata = {
        backup_id: backup.id,
        restaurant_id: backup.restaurant_id,
        file_size: data.length,
        checksum,
        compression_enabled: backup.compression_enabled || false,
        encryption_enabled: backup.encryption_enabled || false,
        created_at: new Date().toISOString()
      }

      switch (provider) {
        case 'r2':
          await this.storeToR2(storagePath, data, metadata)
          break
        case 'kv':
          await this.storeToKV(backup.id, data, metadata)
          break
        default:
          throw new Error(`Unsupported storage provider: ${provider}`)
      }

      return { storage_path: storagePath, checksum }

    } catch (error) {
      console.error('Error storing backup:', error)
      throw new Error(`Failed to store backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Retrieve backup data from storage
   */
  async retrieveBackup(backup: BackupRecord): Promise<string> {
    try {
      let data: string

      switch (backup.storage_provider) {
        case 'r2':
          data = await this.retrieveFromR2(backup.storage_path)
          break
        case 'kv':
          data = await this.retrieveFromKV(backup.id)
          break
        default:
          throw new Error(`Unsupported storage provider: ${backup.storage_provider}`)
      }

      // Verify checksum if available
      if (backup.checksum) {
        const calculatedChecksum = await this.calculateChecksum(data)
        if (calculatedChecksum !== backup.checksum) {
          throw new Error('Backup data integrity check failed - checksum mismatch')
        }
      }

      return data

    } catch (error) {
      console.error('Error retrieving backup:', error)
      throw new Error(`Failed to retrieve backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete backup data from storage
   */
  async deleteBackup(backup: BackupRecord): Promise<void> {
    try {
      switch (backup.storage_provider) {
        case 'r2':
          await this.deleteFromR2(backup.storage_path)
          break
        case 'kv':
          await this.deleteFromKV(backup.id)
          break
        default:
          throw new Error(`Unsupported storage provider: ${backup.storage_provider}`)
      }

    } catch (error) {
      console.error('Error deleting backup:', error)
      throw new Error(`Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if backup exists in storage
   */
  async backupExists(backup: BackupRecord): Promise<boolean> {
    try {
      switch (backup.storage_provider) {
        case 'r2':
          return await this.existsInR2(backup.storage_path)
        case 'kv':
          return await this.existsInKV(backup.id)
        default:
          return false
      }
    } catch (error) {
      console.error('Error checking backup existence:', error)
      return false
    }
  }

  /**
   * Get storage usage statistics for a restaurant
   */
  async getStorageUsage(restaurantId: string): Promise<{
    total_files: number
    total_size_bytes: number
    r2_files: number
    r2_size_bytes: number
    kv_files: number
    kv_size_bytes: number
  }> {
    try {
      // For R2, we can list objects with the restaurant prefix
      const r2Objects = await this.r2Storage.list({ prefix: `backups/${restaurantId}/` })

      let r2Files = 0
      let r2SizeBytes = 0

      for (const object of r2Objects.objects) {
        r2Files++
        r2SizeBytes += object.size
      }

      // For KV, we need to track this separately (KV doesn't have listing by prefix)
      // This would typically be tracked in the database
      const kvFiles = 0
      const kvSizeBytes = 0

      return {
        total_files: r2Files + kvFiles,
        total_size_bytes: r2SizeBytes + kvSizeBytes,
        r2_files: r2Files,
        r2_size_bytes: r2SizeBytes,
        kv_files: kvFiles,
        kv_size_bytes: kvSizeBytes
      }

    } catch (error) {
      console.error('Error getting storage usage:', error)
      throw new Error('Failed to get storage usage statistics')
    }
  }

  /**
   * Cleanup expired backups from storage
   */
  async cleanupExpiredBackups(restaurantId: string, expiredBackups: BackupRecord[]): Promise<number> {
    let cleanedCount = 0

    for (const backup of expiredBackups) {
      try {
        await this.deleteBackup(backup)
        cleanedCount++
        console.log(`Cleaned up expired backup: ${backup.id}`)
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error)
      }
    }

    return cleanedCount
  }

  // Private methods for R2 operations

  private async storeToR2(path: string, data: string, metadata: StorageMetadata): Promise<void> {
    await this.r2Storage.put(path, data, {
      customMetadata: {
        'backup-id': metadata.backup_id,
        'restaurant-id': metadata.restaurant_id,
        'file-size': metadata.file_size.toString(),
        'checksum': metadata.checksum,
        'compression-enabled': metadata.compression_enabled.toString(),
        'encryption-enabled': metadata.encryption_enabled.toString(),
        'created-at': metadata.created_at
      }
    })
  }

  private async retrieveFromR2(path: string): Promise<string> {
    const object = await this.r2Storage.get(path)
    if (!object) {
      throw new Error('Backup file not found in R2 storage')
    }
    return await object.text()
  }

  private async deleteFromR2(path: string): Promise<void> {
    await this.r2Storage.delete(path)
  }

  private async existsInR2(path: string): Promise<boolean> {
    const object = await this.r2Storage.head(path)
    return object !== null
  }

  // Private methods for KV operations

  private async storeToKV(backupId: string, data: string, metadata: StorageMetadata): Promise<void> {
    const key = `backup:${backupId}`
    await this.kvStorage.put(key, data, {
      metadata: {
        backup_id: metadata.backup_id,
        restaurant_id: metadata.restaurant_id,
        file_size: metadata.file_size,
        checksum: metadata.checksum,
        compression_enabled: metadata.compression_enabled,
        encryption_enabled: metadata.encryption_enabled,
        created_at: metadata.created_at
      }
    })
  }

  private async retrieveFromKV(backupId: string): Promise<string> {
    const key = `backup:${backupId}`
    const data = await this.kvStorage.get(key)
    if (!data) {
      throw new Error('Backup file not found in KV storage')
    }
    return data
  }

  private async deleteFromKV(backupId: string): Promise<void> {
    const key = `backup:${backupId}`
    await this.kvStorage.delete(key)
  }

  private async existsInKV(backupId: string): Promise<boolean> {
    const key = `backup:${backupId}`
    const metadata = await this.kvStorage.getWithMetadata(key)
    return metadata.value !== null
  }

  // Utility methods

  private generateStoragePath(restaurantId: string, backupId: string): string {
    const date = new Date().toISOString().split('T')[0]
    return `backups/${restaurantId}/${date}/${backupId}.json`
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Compress data (placeholder for future implementation)
   */
  private async compressData(data: string): Promise<string> {
    // TODO: Implement compression using a compression library
    // For now, return data as-is
    return data
  }

  /**
   * Decompress data (placeholder for future implementation)
   */
  private async decompressData(data: string): Promise<string> {
    // TODO: Implement decompression using a compression library
    // For now, return data as-is
    return data
  }

  /**
   * Encrypt data (placeholder for future implementation)
   */
  private async encryptData(data: string, _key: string): Promise<string> {
    // TODO: Implement encryption using Web Crypto API
    // For now, return data as-is
    return data
  }

  /**
   * Decrypt data (placeholder for future implementation)
   */
  private async decryptData(data: string, _key: string): Promise<string> {
    // TODO: Implement decryption using Web Crypto API
    // For now, return data as-is
    return data
  }

  /**
   * Generate download response for backup
   */
  async generateDownloadResponse(backup: BackupRecord): Promise<Response> {
    try {
      const data = await this.retrieveBackup(backup)
      const fileName = `${backup.name}_${backup.started_at.replace(/[:.]/g, '-')}.json`

      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': data.length.toString(),
          'Cache-Control': 'no-cache'
        }
      })

    } catch (error) {
      console.error('Error generating download response:', error)
      throw new Error('Failed to generate download response')
    }
  }
}