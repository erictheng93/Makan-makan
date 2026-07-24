// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FeedbackDetail from "./FeedbackDetail.vue";
import type { FeedbackItem } from "@/composables/useFeedback";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 99, role: 0 },
  }),
}));

vi.mock("@/composables/useFeedback", () => ({
  useFeedback: () => ({
    addResponse: vi.fn(),
    updateStatus: vi.fn(),
    updateResponse: vi.fn(),
    deleteResponse: vi.fn(),
    updateFeedback: vi.fn(),
    deleteFeedback: vi.fn(),
  }),
}));

const baseFeedback: FeedbackItem = {
  id: 5,
  restaurantId: "restaurant-1",
  userId: 10,
  category: "bug_report",
  priority: "high",
  status: "open",
  relatedModule: "orders",
  subject: "Order screen freezes",
  description: "The order screen freezes during checkout.",
  attachmentUrls: [],
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  resolvedAt: null,
  resolvedBy: null,
  user: { id: 10, username: "owner", fullName: "Shop Owner" },
  restaurant: { id: "restaurant-1", name: "Test Restaurant" },
  responses: [],
};

describe("FeedbackDetail", () => {
  it("renders attachment links only for safe http URLs", () => {
    const wrapper = mount(FeedbackDetail, {
      props: {
        feedback: {
          ...baseFeedback,
          attachmentUrls: [
            "https://cdn.example.test/feedback.png",
            "http://cdn.example.test/log.txt",
            "javascript:alert(document.domain)",
            "data:text/html,<script>alert(1)</script>",
          ],
        },
      },
    });

    const hrefs = wrapper
      .get("[data-testid='feedback-attachments']")
      .findAll("a")
      .map((link) => link.attributes("href"));

    expect(hrefs).toEqual([
      "https://cdn.example.test/feedback.png",
      "http://cdn.example.test/log.txt",
    ]);
  });
});
