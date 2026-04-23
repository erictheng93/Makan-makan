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
    const result = await service.processPayment(input, {
      user,
      gatewayFixture: c.req.header("X-Payment-Gateway-Fixture"),
    });

    return c.json(
      {
        success: true,
        data: result.data,
      },
      result.status as any,
    );
  },
);

export default app;
