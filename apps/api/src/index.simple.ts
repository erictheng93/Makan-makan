import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import type { Env } from "./types/env";

// Import only essential routes for login
import authRouter from "./features/authentication/routes";

// Create simple app
const app = new Hono<{ Bindings: Env }>();

// Basic middleware only
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Essential routes for login
app.route("/api/v1/auth", authRouter);

// Default 404 handler
app.notFound((c) => {
  return c.json(
    { error: "Not Found", message: "The requested endpoint does not exist" },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: "Something went wrong", // Use env.NODE_ENV from bindings if needed
    },
    500,
  );
});

export default app;
