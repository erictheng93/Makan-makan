import axios from "axios";
import { KitchenErrorHandler } from "@/utils/errorHandler";
class ApiService {
  constructor() {
    Object.defineProperty(this, "instance", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.instance = axios.create({
      baseURL: "/api/v1",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.setupInterceptors();
  }
  setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        // 處理 401 未授權錯誤的自動 token 刷新
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;
          try {
            const refreshResponse = await this.instance.post("/auth/refresh");
            const newToken = refreshResponse.data.data.token;
            localStorage.setItem("auth_token", newToken);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.instance(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem("auth_token");
            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        }
        // 使用增強的錯誤處理器處理所有其他錯誤
        const errorDetails = KitchenErrorHandler.handleAPIError(error, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(errorDetails);
      },
    );
  }
  setAuthToken(token) {
    if (token) {
      this.instance.defaults.headers.common["Authorization"] =
        `Bearer ${token}`;
    } else {
      delete this.instance.defaults.headers.common["Authorization"];
    }
  }
  async get(url, params) {
    return this.instance.get(url, { params });
  }
  async post(url, data) {
    return this.instance.post(url, data);
  }
  async put(url, data) {
    return this.instance.put(url, data);
  }
  async patch(url, data) {
    return this.instance.patch(url, data);
  }
  async delete(url) {
    return this.instance.delete(url);
  }
  async upload(url, formData) {
    return this.instance.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }
}
export const api = new ApiService();
