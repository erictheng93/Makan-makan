// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ForecastAlerts from "./ForecastAlerts.vue";

const t = vi.fn((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${params.predicted}` : key,
);
vi.mock("@/i18n", () => ({ useI18n: () => ({ t }) }));

const alert = {
  type: "high_demand" as const,
  menuItemId: 1,
  menuItemName: "Tea",
  message: "legacy message",
  severity: "info" as const,
};

describe("ForecastAlerts", () => {
  it("renders structured localized messages with parameters", () => {
    const wrapper = mount(ForecastAlerts, {
      props: {
        alerts: [
          {
            ...alert,
            messageKey: "forecast.alertHighDemandMessage",
            messageParams: { predicted: 12 },
          },
        ],
      },
    });
    expect(wrapper.text()).toContain("forecast.alertHighDemandMessage:12");
  });

  it("uses the legacy message when structured localization is absent", () => {
    const wrapper = mount(ForecastAlerts, { props: { alerts: [alert] } });
    expect(wrapper.text()).toContain("legacy message");
  });
});
