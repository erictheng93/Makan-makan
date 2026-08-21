// @vitest-environment jsdom

import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrintAgentsView from "./PrintAgentsView.vue";

const getPrintAgents = vi.fn();
const issuePrintAgent = vi.fn();
const revokePrintAgent = vi.fn();
const getRegisters = vi.fn();

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref("zh-TW") }),
}));

vi.mock("@/services/posService", () => ({
  posService: {
    getPrintAgents: (...args: unknown[]) => getPrintAgents(...args),
    issuePrintAgent: (...args: unknown[]) => issuePrintAgent(...args),
    revokePrintAgent: (...args: unknown[]) => revokePrintAgent(...args),
    getRegisters: (...args: unknown[]) => getRegisters(...args),
  },
}));

function agent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    restaurantId: "restaurant-1",
    registerId: null,
    registerName: null,
    label: "廚房出單機",
    status: "online",
    printersTotal: 1,
    printersOnline: 1,
    lastSeenAt: "2026-08-21T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PrintAgentsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPrintAgents.mockResolvedValue([]);
    getRegisters.mockResolvedValue([]);
  });

  it("shows an empty state when no agent has been issued", async () => {
    const wrapper = mount(PrintAgentsView);
    await flushPromises();

    expect(wrapper.find('[data-testid="print-agents-empty"]').exists()).toBe(
      true,
    );
  });

  it("surfaces each agent's status", async () => {
    getPrintAgents.mockResolvedValue([
      agent({ id: "a", status: "no_printer" }),
      agent({ id: "b", status: "offline" }),
    ]);

    const wrapper = mount(PrintAgentsView);
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="print-agent-row"]');
    expect(rows).toHaveLength(2);
    // The distinction this whole feature exists for: an agent that is alive
    // but has no working printer must not read the same as a healthy one.
    expect(rows[0].attributes("data-status")).toBe("no_printer");
    expect(rows[1].attributes("data-status")).toBe("offline");
  });

  it("issues a shop-wide agent when no till is chosen", async () => {
    issuePrintAgent.mockResolvedValue({ ...agent(), key: "mmpa_secret" });

    const wrapper = mount(PrintAgentsView);
    await flushPromises();
    await wrapper.find('[data-testid="issue-agent"]').trigger("click");
    await wrapper.find('[data-testid="agent-label"]').setValue("廚房出單機");
    await wrapper.find('[data-testid="issue-form"]').trigger("submit");
    await flushPromises();

    expect(issuePrintAgent).toHaveBeenCalledWith({
      label: "廚房出單機",
      registerId: undefined,
    });
  });

  it("shows the plaintext key once after issuing", async () => {
    issuePrintAgent.mockResolvedValue({ ...agent(), key: "mmpa_secret" });

    const wrapper = mount(PrintAgentsView);
    await flushPromises();
    await wrapper.find('[data-testid="issue-agent"]').trigger("click");
    await wrapper.find('[data-testid="agent-label"]').setValue("x");
    await wrapper.find('[data-testid="issue-form"]').trigger("submit");
    await flushPromises();

    expect(wrapper.find('[data-testid="issued-key"]').text()).toContain(
      "mmpa_secret",
    );
  });

  it("still renders the agents when the register list cannot be loaded", async () => {
    // The register list only fills a dropdown. Losing it must not hide the
    // health of the agents, which is the reason to open this page.
    getPrintAgents.mockResolvedValue([agent()]);
    getRegisters.mockRejectedValue(new Error("registers unavailable"));

    const wrapper = mount(PrintAgentsView);
    await flushPromises();

    expect(wrapper.findAll('[data-testid="print-agent-row"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="print-agents-error"]').exists()).toBe(
      false,
    );
  });
});
