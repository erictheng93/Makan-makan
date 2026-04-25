import { Hono } from "hono";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { PaymentService } from "../services/PaymentService";
import {
  paymentSchemas,
  type PaymentRequestInput,
} from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

app.post(
  "/",
  idempotencyMiddleware({
    scope: "payment",
    effectId: async (_c, response) => {
      const body = (await response.clone().json()) as {
        data?: { paymentId?: string };
      };
      return body.data?.paymentId ?? null;
    },
  }),
  validateBody(paymentSchemas.processPayment),
  async (c) => {
    const input: PaymentRequestInput = c.get("validatedBody");
    const user: AuthUser | undefined = c.get("user");
    const service = new PaymentService(c.env);
    // Gateway fixture headers bypass real gateway calls and are only honored
    // outside production. In prod, any forged header is ignored so callers
    // cannot fake a timeout/pending payment state.
    const fixtureAllowed = c.env.NODE_ENV !== "production";
    const result = await service.processPayment(input, {
      user,
      gatewayFixture: fixtureAllowed
        ? (c.req.header("X-Payment-Gateway-Fixture") ?? null)
        : null,
    });

    return c.json(
      {
        success: true,
        data: result.data,
      },
      result.status,
    );
  },
);

export default app;
