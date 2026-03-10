/**
 * Users Feature Module
 *
 * This module handles all user management functionality including:
 * - User CRUD operations
 * - Profile management
 * - Password management
 * - User search and filtering
 * - User statistics and analytics
 * - Role-based access control
 */

import routes from "./routes";
export { routes };
export { default as usersRoutes } from "./routes";
export * from "./services/UsersService";
export * from "./types";
export * from "./schemas/validation";

export default {
  routes,
};
