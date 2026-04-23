import actionsRoutes from "./routes/actions";
import auditLogsRoutes from "./routes/audit-logs";

// Manager feature surfaces two independent mount points:
//   - `/manager` hosts the delegation-aware action endpoint
//   - `/audit-logs` hosts the admin-only query endpoint
// They share a schema and DB surface (`audit_logs` table) but intentionally
// live behind different paths and role guards.
export default {
  actionsRoutes,
  auditLogsRoutes,
};
