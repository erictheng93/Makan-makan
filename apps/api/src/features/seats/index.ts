/**
 * Seats Feature Module
 *
 * This module handles seat management including:
 * - Batch seat creation for tables
 * - Individual seat CRUD operations
 * - Seat occupation/release tracking
 * - QR code generation for seats
 * - Seat statistics and status
 */

import routes from "./routes";
export { routes };
export { default as seatsRoutes } from "./routes";
export * from "./types";
// Note: schemas re-export types with same names, using explicit exports to avoid conflicts
export {
  batchCreateSeatsSchema,
  updateSeatSchema,
  occupySeatSchema,
  seatFilterSchema,
  idParamSchema,
  tableIdParamSchema,
  qrCodeParamSchema,
  tableIdQuerySchema,
  batchRegenerateQRSchema,
} from "./schemas/validation";

export default {
  routes,
};
