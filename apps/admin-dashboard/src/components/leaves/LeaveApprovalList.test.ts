// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import LeaveApprovalList from "./LeaveApprovalList.vue";
import type { LeaveRequest } from "@makanmakan/shared-types";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const pendingLeaveRequest = {
  id: 7,
  status: "pending",
  startDate: "2026-06-08",
  endDate: "2026-06-09",
  daysCount: 2,
  reason: "Family event",
  employeeName: "Shop Owner",
  leaveType: { name: "Annual Leave" },
  attachments: [
    { name: "proof.png", url: "https://cdn.example.test/proof.png" },
    { name: "notes.txt", url: "http://cdn.example.test/notes.txt" },
    { name: "script", url: "javascript:alert(document.domain)" },
    { name: "data", url: "data:text/html,<script>alert(1)</script>" },
  ],
} as unknown as LeaveRequest;

describe("LeaveApprovalList", () => {
  it("renders attachment links only for safe http URLs", () => {
    const wrapper = mount(LeaveApprovalList, {
      props: {
        requests: [pendingLeaveRequest],
      },
    });

    const hrefs = wrapper
      .findAll("[data-testid='leave-attachment-link']")
      .map((link) => link.attributes("href"));

    expect(hrefs).toEqual([
      "https://cdn.example.test/proof.png",
      "http://cdn.example.test/notes.txt",
    ]);
  });
});
