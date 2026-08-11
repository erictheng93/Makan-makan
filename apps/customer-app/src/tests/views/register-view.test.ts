import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import RegisterView from "@/views/RegisterView.vue";
import { customerIdentityApi } from "@/services/customerIdentityApi";

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${JSON.stringify(params)}`,
  }),
}));

vi.mock("@/services/customerIdentityApi", () => ({
  customerIdentityApi: {
    resendVerification: vi.fn(),
  },
}));

const storeMocks = vi.hoisted(() => ({
  register: vi.fn(),
  checkAuth: vi.fn(),
  isAuthenticated: false,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => storeMocks,
}));

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

const mountView = () =>
  mount(RegisterView, { global: { stubs: { RouterLink: true } } });

const fillAndSubmit = async (
  wrapper: ReturnType<typeof mountView>,
  identifier: string,
) => {
  await wrapper.find('[data-testid="identifier-input"]').setValue(identifier);
  await wrapper.find('[data-testid="display-name-input"]').setValue("Ah Hock");
  await wrapper
    .find('[data-testid="password-input"]')
    .setValue("correct-horse-battery");
  await wrapper.find("form").trigger("submit");
  await flushPromises();
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterView", () => {
  it("tells the diner to open the verification email", async () => {
    storeMocks.register.mockResolvedValue({
      success: true,
      data: { verificationRequired: true, verificationMethod: "email" },
    });
    const wrapper = mountView();
    await flushPromises();

    await fillAndSubmit(wrapper, "hock@example.com");

    expect(storeMocks.register).toHaveBeenCalledOnce();
    expect(storeMocks.register).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "hock@example.com",
        displayName: "Ah Hock",
      }),
    );
    expect(wrapper.find('[data-testid="email-sent-panel"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("auth.verificationEmailSentTitle");
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("sends a phone registration on to the code screen without re-sending", async () => {
    storeMocks.register.mockResolvedValue({
      success: true,
      data: { verificationRequired: true, verificationMethod: "phone" },
    });
    const wrapper = mountView();
    await flushPromises();

    await fillAndSubmit(wrapper, "+886912345678");

    expect(routerMocks.push).toHaveBeenCalledWith({
      path: "/login",
      query: { phone: "+886912345678", otpSent: "1" },
    });
  });

  it("offers a resend when the account exists but its email never left", async () => {
    storeMocks.register.mockResolvedValue({
      success: false,
      error: "Account created, but the verification email could not be sent.",
      code: "VERIFICATION_EMAIL_FAILED",
    });
    vi.mocked(customerIdentityApi.resendVerification).mockResolvedValue({
      sent: true,
    });
    const wrapper = mountView();
    await flushPromises();

    await fillAndSubmit(wrapper, "hock@example.com");

    // Not a plain error: the account is real, so re-registering cannot help.
    expect(wrapper.find('[data-testid="email-failed-panel"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="auth-error"]').exists()).toBe(false);

    await wrapper.find('[data-testid="resend-verification"]').trigger("click");
    await flushPromises();

    expect(customerIdentityApi.resendVerification).toHaveBeenCalledOnce();
    expect(customerIdentityApi.resendVerification).toHaveBeenCalledWith(
      "hock@example.com",
    );
    expect(wrapper.find('[data-testid="resend-notice"]').text()).toBe(
      "auth.resendVerificationSent",
    );
  });

  it("reports a failed resend instead of claiming the email went out", async () => {
    storeMocks.register.mockResolvedValue({
      success: false,
      error: "Account created, but the verification email could not be sent.",
      code: "VERIFICATION_EMAIL_FAILED",
    });
    vi.mocked(customerIdentityApi.resendVerification).mockRejectedValue(
      new Error("mail provider down"),
    );
    const wrapper = mountView();
    await flushPromises();

    await fillAndSubmit(wrapper, "hock@example.com");
    await wrapper.find('[data-testid="resend-verification"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="resend-notice"]').text()).toBe(
      "auth.resendVerificationFailed",
    );
  });

  it("shows other registration failures on the form itself", async () => {
    storeMocks.register.mockResolvedValue({
      success: false,
      error: "Customer identity already exists",
      code: "IDENTITY_EXISTS",
    });
    const wrapper = mountView();
    await flushPromises();

    await fillAndSubmit(wrapper, "hock@example.com");

    expect(wrapper.find('[data-testid="auth-error"]').text()).toBe(
      "Customer identity already exists",
    );
    expect(wrapper.find('[data-testid="email-failed-panel"]').exists()).toBe(
      false,
    );
  });

  it("rejects a password the API would reject anyway", async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper
      .find('[data-testid="identifier-input"]')
      .setValue("hock@example.com");
    await wrapper
      .find('[data-testid="display-name-input"]')
      .setValue("Ah Hock");
    await wrapper.find('[data-testid="password-input"]').setValue("short");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(storeMocks.register).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("validation.minLength");
  });
});
