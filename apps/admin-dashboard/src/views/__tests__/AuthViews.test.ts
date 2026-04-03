/**
 * AuthViews — Unit tests for LoginView, ForgotPasswordView, ResetPasswordView
 *
 * Covers:
 *  1. LoginView (~15 tests)
 *  2. ForgotPasswordView (~10 tests)
 *  3. ResetPasswordView (~10 tests)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mocks (must precede component imports) ────

const mockPush = vi.fn();
const mockRouteQuery = { token: "test-token-123" };

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockRouteQuery }),
  RouterLink: {
    template: "<a><slot /></a>",
    props: ["to"],
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  t: (key: string) => key,
}));

// Stub lucide icons
vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Eye: stub,
    EyeOff: stub,
    AlertCircle: stub,
    CheckCircle: stub,
    Info: stub,
    User: stub,
    Check: stub,
    X: stub,
  };
});

// Mock API (used by auth store's login)
const mockApiPost = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
const mockApiGet = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });

vi.mock("@/services/api", () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: (...args: any[]) => mockApiGet(...args),
    setAuthToken: vi.fn(),
  },
}));

vi.mock("@makanmakan/utils", () => ({
  getRefreshDelay: () => null,
}));

// Mock global fetch for ForgotPassword and ResetPassword views
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import components after mocks
import LoginView from "../LoginView.vue";
import ForgotPasswordView from "../ForgotPasswordView.vue";
import ResetPasswordView from "../ResetPasswordView.vue";
import { useAuthStore } from "@/stores/auth";

// ──────────────────────────────────────────────
// LoginView
// ──────────────────────────────────────────────

describe("LoginView", () => {
  const mountLogin = () =>
    mount(LoginView, {
      global: {
        stubs: {
          "router-link": { template: "<a><slot /></a>", props: ["to"] },
        },
      },
    });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("should render login form with username and password inputs", () => {
    const wrapper = mountLogin();
    expect(wrapper.find("#username").exists()).toBe(true);
    expect(wrapper.find("#password").exists()).toBe(true);
  });

  it('should render "MakanMakan" heading', () => {
    const wrapper = mountLogin();
    expect(wrapper.text()).toContain("MakanMakan");
  });

  it('should render admin login subtitle via i18n key "auth.adminLogin"', () => {
    const wrapper = mountLogin();
    expect(wrapper.text()).toContain("auth.adminLogin");
  });

  it("should render password visibility toggle button", () => {
    const wrapper = mountLogin();
    // The toggle button is inside the password field's relative div
    const toggleBtn = wrapper
      .find("#password")
      .element.parentElement!.querySelector("button");
    expect(toggleBtn).toBeTruthy();
  });

  it('should render "auth.forgotPasswordLink" link', () => {
    const wrapper = mountLogin();
    expect(wrapper.text()).toContain("auth.forgotPasswordLink");
  });

  it('should render "auth.login" submit button', () => {
    const wrapper = mountLogin();
    const btn = wrapper.find('button[type="submit"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("auth.login");
  });

  it("should call auth store login on form submit", async () => {
    mockApiPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { token: "tok", user: { id: 1, username: "admin", role: 0 } },
      },
    });

    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("admin123");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockApiPost).toHaveBeenCalledWith("/auth/login", {
      username: "admin",
      password: "admin123",
    });
  });

  it("should redirect to /dashboard on successful login", async () => {
    mockApiPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { token: "tok", user: { id: 1, username: "admin", role: 0 } },
      },
    });

    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("admin123");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockPush).toHaveBeenCalledWith("/dashboard/platform");
  });

  it("should show error message on login failure", async () => {
    mockApiPost.mockResolvedValueOnce({
      data: {
        success: false,
        error: { message: "Invalid credentials" },
      },
    });

    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("wrongpass");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid credentials");
  });

  it("should disable button during loading", async () => {
    let resolveLogin: Function;
    mockApiPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("admin123");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    const btn = wrapper.find('button[type="submit"]');
    expect(btn.attributes("disabled")).toBeDefined();

    resolveLogin!({
      data: { success: false, error: { message: "fail" } },
    });
    await flushPromises();
  });

  it("should validate empty username field", async () => {
    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("");
    await wrapper.find("#password").setValue("admin123");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.enterUsername");
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("should validate empty password field", async () => {
    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.enterPassword");
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("should pre-fill username with default value", () => {
    const wrapper = mountLogin();
    const input = wrapper.find("#username").element as HTMLInputElement;
    expect(input.value).toBe("admin");
  });

  it("should handle Enter key submission via form submit", async () => {
    mockApiPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { token: "tok", user: { id: 1, username: "admin", role: 0 } },
      },
    });

    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("admin123");
    // Enter key on form triggers submit.prevent
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockApiPost).toHaveBeenCalled();
  });

  it("should show/hide password on toggle click", async () => {
    const wrapper = mountLogin();
    const passwordInput = wrapper.find("#password");
    expect(passwordInput.attributes("type")).toBe("password");

    // Click the toggle button
    const toggleBtn = wrapper
      .find("#password")
      .element.parentElement!.querySelector("button")!;
    await wrapper
      .find("#password")
      .element.parentElement!.querySelector("button")!
      .click();
    await nextTick();

    // After click, type should change to text
    expect(wrapper.find("#password").attributes("type")).toBe("text");
  });

  it("should validate password minimum length", async () => {
    const wrapper = mountLogin();
    await wrapper.find("#username").setValue("admin");
    await wrapper.find("#password").setValue("short");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.passwordMinLength");
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// ForgotPasswordView
// ──────────────────────────────────────────────

describe("ForgotPasswordView", () => {
  const mountForgot = () =>
    mount(ForgotPasswordView, {
      global: {
        stubs: {
          "router-link": { template: "<a><slot /></a>", props: ["to"] },
        },
      },
    });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();
    mockFetch.mockReset();
  });

  it("should render forgot password form", () => {
    const wrapper = mountForgot();
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.text()).toContain("auth.forgotPasswordSubtitle");
  });

  it("should show email input", () => {
    const wrapper = mountForgot();
    const emailInput = wrapper.find("#email");
    expect(emailInput.exists()).toBe(true);
    expect(emailInput.attributes("type")).toBe("email");
  });

  it("should show submit button with correct text", () => {
    const wrapper = mountForgot();
    const btn = wrapper.find('button[type="submit"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("auth.sendResetEmail");
  });

  it("should call forgot password API on submit", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, message: "Email sent" }),
    });

    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("test@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "test@example.com", method: "email" }),
    });
  });

  it("should show success message after successful submit", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({ success: true, message: "Reset email sent" }),
    });

    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("test@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("auth.emailSent");
    expect(wrapper.text()).toContain("Reset email sent");
  });

  it("should show error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "User not found" }),
    });

    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("unknown@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("User not found");
  });

  it("should validate email format", async () => {
    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("not-an-email");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.invalidEmail");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should show "auth.backToLogin" link', () => {
    const wrapper = mountForgot();
    expect(wrapper.text()).toContain("auth.backToLogin");
  });

  it("should disable button during loading", async () => {
    let resolveJson: Function;
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        json: () =>
          new Promise((resolve) => {
            resolveJson = resolve;
          }),
      }),
    );

    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("test@example.com");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    const btn = wrapper.find('button[type="submit"]');
    expect(btn.attributes("disabled")).toBeDefined();

    resolveJson!({ success: true, message: "ok" });
    await flushPromises();
  });

  it("should handle empty input validation", async () => {
    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.emailRequired");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should show network error on fetch exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const wrapper = mountForgot();
    await wrapper.find("#email").setValue("test@example.com");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("auth.networkError");
  });
});

// ──────────────────────────────────────────────
// ResetPasswordView
// ──────────────────────────────────────────────

describe("ResetPasswordView", () => {
  const mountReset = (queryOverride?: Record<string, string>) => {
    // Temporarily override the route query if needed
    if (queryOverride) {
      Object.assign(mockRouteQuery, queryOverride);
    }
    return mount(ResetPasswordView, {
      global: {
        stubs: {
          "router-link": { template: "<a><slot /></a>", props: ["to"] },
        },
      },
    });
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();
    mockFetch.mockReset();
    // Reset route query to default
    Object.assign(mockRouteQuery, { token: "test-token-123" });
  });

  it("should render reset password form after token verification", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "t***@example.com" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.text()).toContain("auth.resetPasswordSubtitle");
  });

  it("should show new password and confirm password inputs", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "t***@example.com" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    expect(wrapper.find("#new-password").exists()).toBe(true);
    expect(wrapper.find("#confirm-password").exists()).toBe(true);
  });

  it("should validate password match", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    await wrapper.find("#new-password").setValue("Password1!");
    await wrapper.find("#confirm-password").setValue("Different1!");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.passwordMismatch");
  });

  it("should show password strength indicator when typing", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    await wrapper.find("#new-password").setValue("Abc123!@");
    await nextTick();

    // Should show the strength text
    expect(wrapper.text()).toContain("auth.passwordStrength");
  });

  it("should call reset API with token on valid submit", async () => {
    // Token verification
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    // Reset API call
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, message: "Password reset" }),
    });

    await wrapper.find("#new-password").setValue("NewPass1!");
    await wrapper.find("#confirm-password").setValue("NewPass1!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    // Second fetch call is the reset
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "test-token-123",
        newPassword: "NewPass1!",
        confirmPassword: "NewPass1!",
      }),
    });
  });

  it("should show success state and schedule redirect on successful reset", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, message: "Done" }),
    });

    await wrapper.find("#new-password").setValue("NewPass1!");
    await wrapper.find("#confirm-password").setValue("NewPass1!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("auth.resetSuccess");

    // After 2s, should redirect to /login
    vi.advanceTimersByTime(2000);
    expect(mockPush).toHaveBeenCalledWith("/login");

    vi.useRealTimers();
  });

  it("should show error on invalid token", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: false, error: "Token expired" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    expect(wrapper.text()).toContain("Token expired");
    expect(wrapper.text()).toContain("auth.linkInvalid");
  });

  it("should disable submit button during loading", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    let resolveJson: Function;
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        json: () =>
          new Promise((resolve) => {
            resolveJson = resolve;
          }),
      }),
    );

    await wrapper.find("#new-password").setValue("NewPass1!");
    await wrapper.find("#confirm-password").setValue("NewPass1!");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    const btn = wrapper.find('button[type="submit"]');
    expect(btn.attributes("disabled")).toBeDefined();

    resolveJson!({ success: true, message: "ok" });
    await flushPromises();
  });

  it("should show/hide password toggle for new password", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    const pwInput = wrapper.find("#new-password");
    expect(pwInput.attributes("type")).toBe("password");

    // Click toggle
    const toggleBtn = pwInput.element.parentElement!.querySelector("button")!;
    await toggleBtn.click();
    await nextTick();

    expect(wrapper.find("#new-password").attributes("type")).toBe("text");
  });

  it("should validate minimum password length", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ valid: true, email: "" }),
    });

    const wrapper = mountReset();
    await flushPromises();

    await wrapper.find("#new-password").setValue("Ab1!");
    await wrapper.find("#confirm-password").setValue("Ab1!");
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.text()).toContain("auth.passwordMin6");
    // Should not call the reset API
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the token verify call
  });

  it("should show error when no token in URL", async () => {
    // Override route query to have no token
    Object.assign(mockRouteQuery, { token: undefined });

    const wrapper = mount(ResetPasswordView, {
      global: {
        stubs: {
          "router-link": { template: "<a><slot /></a>", props: ["to"] },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("auth.missingToken");
  });
});
