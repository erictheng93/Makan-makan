/**
 * Queue Feature Module
 *
 * Public queue/waitlist HTTP surface. Routes delegate to the production
 * WaitingListService via UnifiedQueueService.
 */

import { queueRoutes } from "./routes";

export const queueFeature = {
  routes: queueRoutes,
  version: "2.0.0",
  name: "queue",
  description: "Unified queue management system",
};

export default queueFeature;

console.log("[queue] INFO: queue module initialized", {
  version: queueFeature.version,
  description: queueFeature.description,
});
