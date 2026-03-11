import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookResult,
  PaymentStatus,
  CountryCode,
  PaymentMethod,
  CountryPaymentConfig,
} from "@makanmakan/shared-types";

interface PaymentOrchestratorConfig {
  defaultTimeout: number;
  maxRetries: number;
  fallbackEnabled: boolean;
}

export class PaymentOrchestrator {
  private providers = new Map<string, PaymentProvider>();
  private countryConfigs = new Map<CountryCode, CountryPaymentConfig>();
  private config: PaymentOrchestratorConfig;

  constructor(config?: Partial<PaymentOrchestratorConfig>) {
    this.config = {
      defaultTimeout: 30000,
      maxRetries: 3,
      fallbackEnabled: true,
      ...config,
    };
  }

  registerProvider(provider: PaymentProvider): void {
    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for provider: ${provider.name}`);
    }
    this.providers.set(provider.name, provider);
  }

  setCountryConfig(country: CountryCode, config: CountryPaymentConfig): void {
    this.countryConfigs.set(country, config);
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      // 驗證請求
      this.validatePaymentRequest(request);

      // 獲取國家配置
      const countryConfig = this.countryConfigs.get(request.country);
      if (!countryConfig) {
        throw new Error(
          `No payment configuration found for country: ${request.country}`,
        );
      }

      // 驗證金額範圍
      if (
        request.amount < countryConfig.minimumAmount ||
        request.amount > countryConfig.maximumAmount
      ) {
        throw new Error(`Payment amount out of range: ${request.amount}`);
      }

      // 選擇最佳支付提供商
      const primaryProvider = this.selectProvider(request, countryConfig);

      let lastError: Error | null = null;

      // 嘗試主要提供商
      try {
        const result = await this.executePaymentWithTimeout(
          primaryProvider,
          request,
        );

        // 記錄成功的支付
        await this.logPaymentAttempt(
          request,
          primaryProvider.name,
          result,
          Date.now() - startTime,
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Primary provider ${primaryProvider.name} failed:`, error);
      }

      // 如果啟用了容錯機制，嘗試備用提供商
      if (
        this.config.fallbackEnabled &&
        countryConfig.fallbackProviders.length > 0
      ) {
        for (const fallbackProviderName of countryConfig.fallbackProviders) {
          const fallbackProvider = this.providers.get(fallbackProviderName);
          if (!fallbackProvider) continue;

          // 檢查該提供商是否支援此支付方式
          if (!fallbackProvider.supportedMethods.includes(request.method))
            continue;

          try {
            const result = await this.executePaymentWithTimeout(
              fallbackProvider,
              request,
            );

            // 記錄成功的備用支付
            await this.logPaymentAttempt(
              request,
              fallbackProvider.name,
              result,
              Date.now() - startTime,
              true,
            );

            return result;
          } catch (error) {
            console.warn(
              `Fallback provider ${fallbackProvider.name} failed:`,
              error,
            );
            lastError = error as Error;
          }
        }
      }

      // 所有提供商都失敗
      const failureResult: PaymentResult = {
        success: false,
        transactionId: "",
        status: "failed",
        error: {
          code: "PROVIDER_FAILURE",
          message: "All payment providers failed",
          details: lastError?.message,
        },
      };

      await this.logPaymentAttempt(
        request,
        "none",
        failureResult,
        Date.now() - startTime,
      );
      return failureResult;
    } catch (error) {
      const errorResult: PaymentResult = {
        success: false,
        transactionId: "",
        status: "failed",
        error: {
          code: "ORCHESTRATOR_ERROR",
          message: (error as Error).message,
        },
      };

      await this.logPaymentAttempt(
        request,
        "none",
        errorResult,
        Date.now() - startTime,
      );
      return errorResult;
    }
  }

  async getPaymentStatus(
    transactionId: string,
    providerId?: string,
  ): Promise<PaymentStatus> {
    if (providerId) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      return await provider.getPaymentStatus(transactionId);
    }

    // 如果沒有指定提供商，遍歷所有提供商查詢
    for (const [, provider] of this.providers) {
      try {
        const status = await provider.getPaymentStatus(transactionId);
        if (status !== "pending") {
          return status;
        }
      } catch {
        // 忽略錯誤，繼續下一個提供商
        continue;
      }
    }

    return "pending";
  }

  async refundPayment(
    request: RefundRequest,
    providerId: string,
  ): Promise<RefundResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    try {
      const result = await provider.refundPayment(request);
      await this.logRefundAttempt(request, providerId, result);
      return result;
    } catch (error) {
      const errorResult: RefundResult = {
        success: false,
        refundId: "",
        amount: request.amount || 0,
        status: "failed",
        error: {
          code: "REFUND_FAILED",
          message: (error as Error).message,
        },
      };
      await this.logRefundAttempt(request, providerId, errorResult);
      return errorResult;
    }
  }

  async handleWebhook(
    providerId: string,
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    return await provider.handleWebhook(payload, signature);
  }

  private selectProvider(
    request: PaymentRequest,
    config: CountryPaymentConfig,
  ): PaymentProvider {
    // 首先檢查是否有針對特定支付方式的偏好
    const methodSpecificProvider = this.getMethodSpecificProvider(
      request.method,
      request.country,
    );
    if (methodSpecificProvider) {
      return methodSpecificProvider;
    }

    // 否則使用國家的主要提供商
    const primaryProvider = this.providers.get(config.primaryProvider);
    if (!primaryProvider) {
      throw new Error(`Primary provider not found: ${config.primaryProvider}`);
    }

    // 檢查該提供商是否支援此支付方式
    if (!primaryProvider.supportedMethods.includes(request.method)) {
      throw new Error(
        `Primary provider ${config.primaryProvider} does not support method: ${request.method}`,
      );
    }

    return primaryProvider;
  }

  private getMethodSpecificProvider(
    method: PaymentMethod,
    country: CountryCode,
  ): PaymentProvider | null {
    // 針對特定支付方式的提供商映射
    const methodProviderMap: Record<string, string> = {
      [`ecpay_${country}`]: "ecpay",
      [`line_pay_${country}`]: "line_pay",
      [`fpx_${country}`]: "ipay88",
      [`touch_n_go_${country}`]: "ipay88",
      [`grab_pay_${country}`]: "grab_pay",
      [`momo_${country}`]: "vnpay",
      [`zalo_pay_${country}`]: "vnpay",
      [`viet_qr_${country}`]: "vnpay",
    };

    const providerName = methodProviderMap[`${method}_${country}`];
    return providerName ? this.providers.get(providerName) || null : null;
  }

  private async executePaymentWithTimeout(
    provider: PaymentProvider,
    request: PaymentRequest,
  ): Promise<PaymentResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Payment timeout after ${this.config.defaultTimeout}ms`),
        );
      }, this.config.defaultTimeout);

      provider
        .createPayment(request)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private validatePaymentRequest(request: PaymentRequest): void {
    if (!request.orderId) throw new Error("Order ID is required");
    if (!request.restaurantId) throw new Error("Restaurant ID is required");
    if (!request.country) throw new Error("Country is required");
    if (!request.currency) throw new Error("Currency is required");
    if (!request.amount || request.amount <= 0)
      throw new Error("Valid amount is required");
    if (!request.method) throw new Error("Payment method is required");
  }

  private async logPaymentAttempt(
    request: PaymentRequest,
    providerId: string,
    result: PaymentResult,
    duration: number,
    isFallback: boolean = false,
  ): Promise<void> {
    // TODO: 實作日誌記錄到資料庫或監控系統
    console.log(
      `Payment attempt - Provider: ${providerId}, Success: ${result.success}, Duration: ${duration}ms, Fallback: ${isFallback}`,
    );
  }

  private async logRefundAttempt(
    request: RefundRequest,
    providerId: string,
    result: RefundResult,
  ): Promise<void> {
    // TODO: 實作退款日誌記錄
    console.log(
      `Refund attempt - Provider: ${providerId}, Success: ${result.success}`,
    );
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getCountryConfigs(): Map<CountryCode, CountryPaymentConfig> {
    return new Map(this.countryConfigs);
  }
}
