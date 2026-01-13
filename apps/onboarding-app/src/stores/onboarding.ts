/**
 * Onboarding Store
 * 客戶申請流程狀態管理
 */

import { defineStore } from "pinia";
import { ref } from "vue";

export interface ApplicationData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planId: string;
  subdomain?: string;
  status: "pending" | "processing" | "completed";
}

export interface CloudflareInfo {
  accountId: string;
  apiToken: string;
}

export const useOnboardingStore = defineStore("onboarding", () => {
  // 狀態
  const application = ref<ApplicationData | null>(null);
  const cloudflareInfo = ref<CloudflareInfo | null>(null);

  // 方法
  function setApplication(data: ApplicationData) {
    application.value = data;
    // 持久化到 sessionStorage
    sessionStorage.setItem("onboarding_application", JSON.stringify(data));
  }

  function setCloudflareInfo(info: CloudflareInfo) {
    cloudflareInfo.value = info;
    // 不持久化敏感資訊
  }

  function loadFromSession() {
    const stored = sessionStorage.getItem("onboarding_application");
    if (stored) {
      try {
        application.value = JSON.parse(stored);
      } catch {
        // 忽略解析錯誤
      }
    }
  }

  function reset() {
    application.value = null;
    cloudflareInfo.value = null;
    sessionStorage.removeItem("onboarding_application");
  }

  // 初始化時載入
  loadFromSession();

  return {
    application,
    cloudflareInfo,
    setApplication,
    setCloudflareInfo,
    loadFromSession,
    reset,
  };
});
