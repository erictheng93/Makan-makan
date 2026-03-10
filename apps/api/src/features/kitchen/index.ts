/**
 * Kitchen Feature Module
 * Main entry point for kitchen functionality
 */

import kitchenRoutes from "./routes/index";
export { kitchenRoutes };
export { KitchenService } from "./services/KitchenService";
export * from "./types";

// Create default export
const kitchenFeature = {
  routes: kitchenRoutes,
  name: "kitchen",
  version: "1.0.0",
  description: "Kitchen display and order management with real-time SSE events",
  dependencies: ["orders", "authentication"],
  capabilities: [
    "sse-events",
    "order-tracking",
    "status-updates",
    "real-time-notifications",
  ],
};

export default kitchenFeature;
