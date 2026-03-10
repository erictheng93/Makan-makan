/**
 * Core Database Module
 * Centralized database connection and service management
 */

// Re-export existing database functionality
import { createDatabase as createDB } from "@makanmakan/database";
export const createDatabase = createDB;
export type { Database } from "@makanmakan/database";

// Database connection helper for features
import type { Env } from "../../shared/types";

export const getDatabaseConnection = (env: Env) => {
  return createDatabase(env.DB);
};

// Common database operations interface
export interface DatabaseOperations {
  findById<T>(table: string, id: number): Promise<T | null>;
  create<T>(
    table: string,
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
  ): Promise<T>;
  update<T>(table: string, id: number, data: Partial<T>): Promise<T | null>;
  delete(table: string, id: number): Promise<boolean>;
  findMany<T>(table: string, filters?: Record<string, unknown>): Promise<T[]>;
}
