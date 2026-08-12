import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { FeedbackService } from "./FeedbackService";

describe("FeedbackService.listFeedback authorization scope", () => {
  it("requires a user filter when a non-admin lists feedback", async () => {
    const service = new FeedbackService({} as D1Database, {
      JWT_SECRET: "test",
    });

    await expect(service.listFeedback({}, 1, 20, false)).rejects.toThrow(
      "userId filter is required when listing feedback as a non-admin",
    );
  });
});
