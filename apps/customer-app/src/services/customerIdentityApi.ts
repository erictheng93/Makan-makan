import { apiClient } from "./api";

export interface CustomerSummary {
  id: string;
  displayName: string;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  status: string;
  lastSeenAtMs?: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CustomerPreferences {
  dietaryTags: string[];
  allergens: string[];
  defaultPartySize: number | null;
  marketingOptIn: boolean;
  waitingListOptIn: boolean;
  promoFromFavoritesOptIn: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAtMs: number | null;
}

export interface CustomerSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  customer: CustomerSummary;
}

export interface CustomerFavorite {
  id: number;
  targetType: "market" | "restaurant" | "dish";
  targetId: string;
  createdAtMs: number;
}

export interface CustomerRecentMarket {
  marketId: string;
  visitedAtMs: number;
}

export interface CustomerPushSubscription {
  id: string;
  endpoint: string;
  device_label?: string | null;
  created_at_ms?: number;
}

export const customerIdentityApi = {
  requestOtp(phone: string) {
    return apiClient.post<{
      phone: string;
      expiresInSeconds: number;
      devOtp?: string;
    }>("/customer/auth/request-otp", { phone });
  },

  verifyOtp(phone: string, otp: string) {
    return apiClient.post<CustomerSession>("/customer/auth/verify-otp", {
      phone,
      otp,
    });
  },

  refresh() {
    return apiClient.post<Omit<CustomerSession, "customer">>(
      "/customer/auth/refresh",
      {},
      { withCredentials: true },
    );
  },

  logout() {
    return apiClient.post(
      "/customer/auth/logout",
      {},
      { withCredentials: true },
    );
  },

  getMe() {
    return apiClient.get<{
      customer: CustomerSummary;
      preferences: CustomerPreferences;
    }>("/customer/me");
  },

  updateMe(input: {
    displayName?: string;
    avatarUrl?: string | null;
    locale?: string | null;
  }) {
    return apiClient.patch<{ customer: CustomerSummary }>(
      "/customer/me",
      input,
    );
  },

  updatePreferences(input: Partial<CustomerPreferences>) {
    return apiClient.patch<CustomerPreferences>("/customer/preferences", input);
  },

  listFavorites(targetType?: CustomerFavorite["targetType"]) {
    return apiClient.get<CustomerFavorite[]>("/customer/favorites", {
      ...(targetType ? { targetType } : {}),
    });
  },

  addFavorite(input: {
    targetType: CustomerFavorite["targetType"];
    targetId: string;
  }) {
    return apiClient.post<CustomerFavorite>("/customer/favorites", input);
  },

  removeFavorite(id: number | string) {
    return apiClient.delete(`/customer/favorites/${id}`);
  },

  listRecentMarkets(limit = 8) {
    return apiClient.get<CustomerRecentMarket[]>("/customer/recent-markets", {
      limit,
    });
  },

  recordRecentMarket(input: { marketId: string; visitedAtMs?: number }) {
    return apiClient.post<CustomerRecentMarket>(
      "/customer/recent-markets",
      input,
    );
  },

  addPushSubscription(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
    deviceLabel?: string;
  }) {
    return apiClient.post<CustomerPushSubscription>(
      "/customer/push-subscriptions",
      input,
    );
  },

  listPushSubscriptions() {
    return apiClient.get<
      Array<{
        id: string;
        endpoint: string;
        device_label?: string | null;
      }>
    >("/customer/push-subscriptions");
  },

  removePushSubscription(id: string) {
    return apiClient.delete(`/customer/push-subscriptions/${id}`);
  },

  grantConsent(input: {
    consentType:
      | "marketing"
      | "analytics"
      | "location"
      | "data_share"
      | "terms_of_service"
      | "privacy_policy";
    version: string;
    granted: boolean;
    source?: "onboarding" | "settings" | "inline_prompt";
  }) {
    return apiClient.post("/customer/consents", input);
  },
};

export default customerIdentityApi;
