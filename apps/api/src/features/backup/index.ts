/**
 * Backup Feature Module Entry Point
 * Modular backup system following MakanMakan architecture patterns
 */

export { BackupController } from "./controllers/BackupController";
export { BackupService } from "./services/BackupService";
export { BackupConfigService } from "./services/BackupConfigService";
export { BackupStorageService } from "./services/BackupStorageService";
export { BackupSchedulerService } from "./services/BackupSchedulerService";
export { BackupValidationService } from "./services/BackupValidationService";
export { BackupRoutes } from "./routes";

// Re-export types for convenience
export type {
  BackupConfiguration,
  BackupRecord,
  BackupSystemHealth,
  BackupAlert,
  CreateBackupRequest,
  CreateBackupResponse,
  ListBackupsQuery,
  RestoreBackupRequest,
} from "@makanmakan/shared-types";
