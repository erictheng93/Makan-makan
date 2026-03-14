import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { validateBody, validateQuery, validateParams } from "../validation";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function createApp() {
  const app = new Hono();
  app.post("/test", validateBody(testSchema), (c) =>
    c.json({ success: true, data: c.get("validatedBody") }),
  );
  return app;
}

describe("validation middleware error format", () => {
  it("should return unified error shape on validation failure", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", age: -1 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(body.error).toHaveProperty("message", "Validation failed");
    expect(body.error).toHaveProperty("details");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toHaveProperty("field");
    expect(body.error.details[0]).toHaveProperty("message");
  });

  it("should return unified shape on invalid JSON body", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "INVALID_JSON");
    expect(body.error).toHaveProperty("message");
  });
});
