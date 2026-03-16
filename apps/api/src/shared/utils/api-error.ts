/**
 * Re-export from shared package.
 * Keeps existing imports working without changing 50+ files.
 */
export {
  ApiError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
} from "@makanmakan/utils";
