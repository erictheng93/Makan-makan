import { describe, it, expect } from "vitest";
import {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
  addResponseSchema,
  feedbackFiltersSchema,
  feedbackIdParamSchema,
} from "../schemas/validation";

describe("Feedback Validation Schemas", () => {
  // ─── createFeedbackSchema ─────────────────────────────────────────
  describe("createFeedbackSchema", () => {
    const valid = {
      subject: "Login page crashes on mobile",
      description: "Whenever I open the login page on iOS Safari it crashes immediately.",
      category: "bug_report" as const,
    };

    it("accepts minimal valid payload", () => {
      expect(createFeedbackSchema.safeParse(valid).success).toBe(true);
    });

    it("accepts full payload with all optional fields", () => {
      const result = createFeedbackSchema.safeParse({
        ...valid,
        priority: "high",
        relatedModule: "orders",
        attachmentUrls: ["https://example.com/screenshot.png"],
      });
      expect(result.success).toBe(true);
    });

    // subject boundaries
    it("rejects subject shorter than 5 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, subject: "Bug" }).success,
      ).toBe(false);
    });

    it("accepts subject at exactly 5 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, subject: "A".repeat(5) }).success,
      ).toBe(true);
    });

    it("accepts subject at exactly 200 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, subject: "A".repeat(200) }).success,
      ).toBe(true);
    });

    it("rejects subject longer than 200 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, subject: "A".repeat(201) }).success,
      ).toBe(false);
    });

    // description boundaries
    it("rejects description shorter than 10 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, description: "Short" }).success,
      ).toBe(false);
    });

    it("accepts description at exactly 10 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, description: "A".repeat(10) }).success,
      ).toBe(true);
    });

    it("accepts description at exactly 5000 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, description: "A".repeat(5000) }).success,
      ).toBe(true);
    });

    it("rejects description longer than 5000 characters", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, description: "A".repeat(5001) }).success,
      ).toBe(false);
    });

    // category enum
    it("accepts all valid category values", () => {
      const categories = [
        "bug_report",
        "feature_request",
        "usability",
        "performance",
        "billing",
        "other",
      ];
      for (const category of categories) {
        expect(
          createFeedbackSchema.safeParse({ ...valid, category }).success,
          `expected category "${category}" to be valid`,
        ).toBe(true);
      }
    });

    it("rejects invalid category value", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, category: "complaint" }).success,
      ).toBe(false);
    });

    // priority enum
    it("accepts all valid priority values", () => {
      for (const priority of ["low", "medium", "high", "urgent"]) {
        expect(
          createFeedbackSchema.safeParse({ ...valid, priority }).success,
          `expected priority "${priority}" to be valid`,
        ).toBe(true);
      }
    });

    it("rejects invalid priority value", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, priority: "critical" }).success,
      ).toBe(false);
    });

    it("allows missing priority (optional)", () => {
      const { priority: _, ...withoutPriority } = { ...valid, priority: "high" };
      expect(createFeedbackSchema.safeParse(valid).success).toBe(true);
    });

    // relatedModule enum
    it("accepts all valid relatedModule values", () => {
      const modules = [
        "menu", "orders", "pos", "tables", "reservations",
        "scheduling", "analytics", "settings", "integrations", "other",
      ];
      for (const relatedModule of modules) {
        expect(
          createFeedbackSchema.safeParse({ ...valid, relatedModule }).success,
          `expected module "${relatedModule}" to be valid`,
        ).toBe(true);
      }
    });

    it("rejects invalid relatedModule value", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, relatedModule: "payments" }).success,
      ).toBe(false);
    });

    // attachmentUrls
    it("accepts empty attachmentUrls array", () => {
      expect(
        createFeedbackSchema.safeParse({ ...valid, attachmentUrls: [] }).success,
      ).toBe(true);
    });

    it("accepts up to 5 attachment URLs", () => {
      const urls = Array.from(
        { length: 5 },
        (_, i) => `https://example.com/img${i}.png`,
      );
      expect(
        createFeedbackSchema.safeParse({ ...valid, attachmentUrls: urls }).success,
      ).toBe(true);
    });

    it("rejects more than 5 attachment URLs", () => {
      const urls = Array.from(
        { length: 6 },
        (_, i) => `https://example.com/img${i}.png`,
      );
      expect(
        createFeedbackSchema.safeParse({ ...valid, attachmentUrls: urls }).success,
      ).toBe(false);
    });

    it("rejects attachment URLs that are not valid URLs", () => {
      expect(
        createFeedbackSchema.safeParse({
          ...valid,
          attachmentUrls: ["not-a-url"],
        }).success,
      ).toBe(false);
    });

    // required fields
    it("rejects missing subject", () => {
      const { subject: _, ...noSubject } = valid;
      expect(createFeedbackSchema.safeParse(noSubject).success).toBe(false);
    });

    it("rejects missing description", () => {
      const { description: _, ...noDesc } = valid;
      expect(createFeedbackSchema.safeParse(noDesc).success).toBe(false);
    });

    it("rejects missing category", () => {
      const { category: _, ...noCat } = valid;
      expect(createFeedbackSchema.safeParse(noCat).success).toBe(false);
    });
  });

  // ─── updateFeedbackStatusSchema ───────────────────────────────────
  describe("updateFeedbackStatusSchema", () => {
    it("accepts all valid status values", () => {
      for (const status of ["open", "in_progress", "resolved", "closed"]) {
        expect(
          updateFeedbackStatusSchema.safeParse({ status }).success,
          `expected status "${status}" to be valid`,
        ).toBe(true);
      }
    });

    it("rejects invalid status value", () => {
      expect(
        updateFeedbackStatusSchema.safeParse({ status: "pending" }).success,
      ).toBe(false);
    });

    it("rejects missing status", () => {
      expect(updateFeedbackStatusSchema.safeParse({}).success).toBe(false);
    });
  });

  // ─── addResponseSchema ────────────────────────────────────────────
  describe("addResponseSchema", () => {
    it("accepts valid message", () => {
      expect(
        addResponseSchema.safeParse({ message: "Thank you for your feedback." }).success,
      ).toBe(true);
    });

    it("accepts message at exactly 1 character", () => {
      expect(addResponseSchema.safeParse({ message: "x" }).success).toBe(true);
    });

    it("accepts message at exactly 2000 characters", () => {
      expect(
        addResponseSchema.safeParse({ message: "A".repeat(2000) }).success,
      ).toBe(true);
    });

    it("rejects empty message", () => {
      expect(addResponseSchema.safeParse({ message: "" }).success).toBe(false);
    });

    it("rejects message longer than 2000 characters", () => {
      expect(
        addResponseSchema.safeParse({ message: "A".repeat(2001) }).success,
      ).toBe(false);
    });

    it("defaults isInternal to false when omitted", () => {
      const result = addResponseSchema.safeParse({ message: "Hello" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isInternal).toBe(false);
    });

    it("accepts isInternal: true", () => {
      const result = addResponseSchema.safeParse({
        message: "Internal note",
        isInternal: true,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isInternal).toBe(true);
    });

    it("rejects non-boolean isInternal", () => {
      expect(
        addResponseSchema.safeParse({ message: "Hello", isInternal: "yes" }).success,
      ).toBe(false);
    });
  });

  // ─── feedbackFiltersSchema ────────────────────────────────────────
  describe("feedbackFiltersSchema", () => {
    it("accepts empty object (all optional)", () => {
      const result = feedbackFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("applies default page=1 and limit=20", () => {
      const result = feedbackFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("coerces page from string to number", () => {
      const result = feedbackFiltersSchema.safeParse({ page: "3" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(3);
    });

    it("coerces limit from string to number", () => {
      const result = feedbackFiltersSchema.safeParse({ limit: "50" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(50);
    });

    it("rejects limit greater than 100", () => {
      expect(feedbackFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it("accepts limit equal to 100", () => {
      expect(feedbackFiltersSchema.safeParse({ limit: 100 }).success).toBe(true);
    });

    it("rejects negative page", () => {
      expect(feedbackFiltersSchema.safeParse({ page: -1 }).success).toBe(false);
    });

    it("rejects page = 0", () => {
      expect(feedbackFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
    });

    it("accepts valid category filter", () => {
      expect(
        feedbackFiltersSchema.safeParse({ category: "bug_report" }).success,
      ).toBe(true);
    });

    it("rejects invalid category filter", () => {
      expect(
        feedbackFiltersSchema.safeParse({ category: "complaint" }).success,
      ).toBe(false);
    });

    it("accepts valid status filter", () => {
      expect(
        feedbackFiltersSchema.safeParse({ status: "in_progress" }).success,
      ).toBe(true);
    });

    it("rejects invalid status filter", () => {
      expect(
        feedbackFiltersSchema.safeParse({ status: "stale" }).success,
      ).toBe(false);
    });

    it("accepts search string up to 200 characters", () => {
      expect(
        feedbackFiltersSchema.safeParse({ search: "A".repeat(200) }).success,
      ).toBe(true);
    });

    it("rejects search string longer than 200 characters", () => {
      expect(
        feedbackFiltersSchema.safeParse({ search: "A".repeat(201) }).success,
      ).toBe(false);
    });
  });

  // ─── feedbackIdParamSchema ────────────────────────────────────────
  describe("feedbackIdParamSchema", () => {
    it("accepts positive integer id", () => {
      const result = feedbackIdParamSchema.safeParse({ id: 42 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(42);
    });

    it("coerces string id to number", () => {
      const result = feedbackIdParamSchema.safeParse({ id: "7" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(7);
    });

    it("rejects id = 0", () => {
      expect(feedbackIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
    });

    it("rejects negative id", () => {
      expect(feedbackIdParamSchema.safeParse({ id: -5 }).success).toBe(false);
    });

    it("rejects non-numeric string id", () => {
      expect(feedbackIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
    });

    it("rejects missing id", () => {
      expect(feedbackIdParamSchema.safeParse({}).success).toBe(false);
    });
  });
});
