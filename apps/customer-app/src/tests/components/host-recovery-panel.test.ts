import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const recoverHost = vi.hoisted(() => vi.fn());

vi.mock("@/composables/useGroupOrder", () => ({
  useGroupOrder: () => ({ recoverHost }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import HostRecoveryPanel from "@/components/group/HostRecoveryPanel.vue";
import { saveHostCredentials } from "@/utils/groupOrderSession";

function mountPanel() {
  return mount(HostRecoveryPanel, { props: { groupOrderId: "go-1" } });
}

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("HostRecoveryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("keeps the recovery code hidden until the host asks for it", async () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "s-1",
      recoveryCode: "recovery-1",
    });

    const wrapper = mountPanel();
    await flushPromises();

    // This runs on a phone at a shared table. A recovery code left on screen
    // is a recovery code anyone sitting there can photograph.
    expect(wrapper.text()).not.toContain("recovery-1");

    await wrapper.find('[data-testid="reveal-recovery-code"]').trigger("click");
    expect(
      wrapper.find('[data-testid="recovery-code-value"]').text(),
    ).toContain("recovery-1");
  });

  it("offers the recovery input when this device holds no credentials", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="recovery-code-input"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="reveal-recovery-code"]').exists()).toBe(
      false,
    );
  });

  it("tells the host a code was wrong", async () => {
    recoverHost.mockRejectedValueOnce(apiError(400));

    const wrapper = mountPanel();
    await flushPromises();
    await wrapper.find('[data-testid="recovery-code-input"]').setValue("nope");
    await wrapper.find('[data-testid="recovery-submit"]').trigger("click");
    await flushPromises();

    const message = wrapper.find('[data-testid="recovery-error"]').text();
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/15/);
  });

  it("tells the host how long they are locked out after too many attempts", async () => {
    recoverHost.mockRejectedValueOnce(apiError(429));

    const wrapper = mountPanel();
    await flushPromises();
    await wrapper.find('[data-testid="recovery-code-input"]').setValue("nope");
    await wrapper.find('[data-testid="recovery-submit"]').trigger("click");
    await flushPromises();

    // /recover allows five attempts per fifteen minutes. A generic failure
    // message leaves the host retrying into a wall with no idea why.
    expect(wrapper.find('[data-testid="recovery-error"]').text()).toMatch(/15/);
  });

  it("does not spend an attempt on an empty code", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.find('[data-testid="recovery-submit"]').trigger("click");

    expect(recoverHost).not.toHaveBeenCalled();
  });
});
