import {
  PaymentProviderConfig,
  CountryPaymentConfig,
  CountryCode,
  PaymentMethod
} from '@makanmakan/shared-types'
import { getCurrentTimestamp } from '@makanmakan/database'

interface DatabaseConnection {
  prepare(sql: string): any
  exec(sql: string): any
}

export class PaymentConfigManager {
  constructor(private db: DatabaseConnection) {}

  // =============================================
  // 支付提供商管理
  // =============================================

  async getPaymentProvider(name: string): Promise<PaymentProviderConfig | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_providers 
      WHERE name = ? AND is_active = 1
    `)
    
    const row = stmt.get(name)
    if (!row) return null

    return {
      name: row.name,
      displayName: row.display_name,
      isActive: Boolean(row.is_active),
      supportedCountries: JSON.parse(row.supported_countries),
      supportedMethods: JSON.parse(row.supported_methods),
      testMode: Boolean(row.test_mode),
      config: {},
      webhookEndpoint: row.webhook_endpoint
    }
  }

  async getAllPaymentProviders(): Promise<PaymentProviderConfig[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_providers 
      WHERE is_active = 1 
      ORDER BY name
    `)
    
    const rows = stmt.all()
    return rows.map((row: any) => ({
      name: row.name,
      displayName: row.display_name,
      isActive: Boolean(row.is_active),
      supportedCountries: JSON.parse(row.supported_countries),
      supportedMethods: JSON.parse(row.supported_methods),
      testMode: Boolean(row.test_mode),
      config: {},
      webhookEndpoint: row.webhook_endpoint
    }))
  }

  async createPaymentProvider(config: PaymentProviderConfig): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO payment_providers (
        name, display_name, is_active, supported_countries, 
        supported_methods, test_mode, webhook_endpoint
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      config.name,
      config.displayName,
      config.isActive,
      JSON.stringify(config.supportedCountries),
      JSON.stringify(config.supportedMethods),
      config.testMode,
      config.webhookEndpoint
    )
  }

  async updatePaymentProvider(name: string, config: Partial<PaymentProviderConfig>): Promise<void> {
    const updates: string[] = []
    const values: any[] = []

    if (config.displayName !== undefined) {
      updates.push('display_name = ?')
      values.push(config.displayName)
    }
    if (config.isActive !== undefined) {
      updates.push('is_active = ?')
      values.push(config.isActive)
    }
    if (config.supportedCountries !== undefined) {
      updates.push('supported_countries = ?')
      values.push(JSON.stringify(config.supportedCountries))
    }
    if (config.supportedMethods !== undefined) {
      updates.push('supported_methods = ?')
      values.push(JSON.stringify(config.supportedMethods))
    }
    if (config.testMode !== undefined) {
      updates.push('test_mode = ?')
      values.push(config.testMode)
    }
    if (config.webhookEndpoint !== undefined) {
      updates.push('webhook_endpoint = ?')
      values.push(config.webhookEndpoint)
    }

    if (updates.length === 0) return

    updates.push('updated_at = ?')
    values.push(getCurrentTimestamp())
    values.push(name)

    const stmt = this.db.prepare(`
      UPDATE payment_providers 
      SET ${updates.join(', ')} 
      WHERE name = ?
    `)

    stmt.run(...values)
  }

  // =============================================
  // 提供商配置管理 (敏感資訊)
  // =============================================

  async getProviderConfig(providerId: string, countryCode: CountryCode): Promise<Record<string, any> | null> {
    const stmt = this.db.prepare(`
      SELECT ppc.config_data, ppc.config_hash
      FROM payment_provider_configs ppc
      JOIN payment_providers pp ON pp.id = ppc.provider_id
      WHERE pp.name = ? AND ppc.country_code = ?
    `)

    const row = stmt.get(providerId, countryCode)
    if (!row) return null

    // 在實際環境中，這裡應該解密 config_data
    try {
      const config = JSON.parse(row.config_data)
      
      // 驗證配置完整性
      const hash = this.generateConfigHash(row.config_data)
      if (hash !== row.config_hash) {
        throw new Error('Configuration integrity check failed')
      }

      return config
    } catch (error) {
      console.error('Failed to parse provider config:', error)
      return null
    }
  }

  async setProviderConfig(
    providerId: string, 
    countryCode: CountryCode, 
    config: Record<string, any>,
    isPrimary: boolean = false,
    isTestMode: boolean = true
  ): Promise<void> {
    const configData = JSON.stringify(config)
    const configHash = this.generateConfigHash(configData)

    // 在實際環境中，configData 應該被加密
    const encryptedConfigData = configData // TODO: 加密處理

    // 首先獲取 provider_id
    const providerStmt = this.db.prepare(`
      SELECT id FROM payment_providers WHERE name = ?
    `)
    const provider = providerStmt.get(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    // 插入或更新配置
    const upsertStmt = this.db.prepare(`
      INSERT INTO payment_provider_configs (
        provider_id, country_code, is_primary, is_test_mode, 
        config_data, config_hash
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, country_code) DO UPDATE SET
        is_primary = excluded.is_primary,
        is_test_mode = excluded.is_test_mode,
        config_data = excluded.config_data,
        config_hash = excluded.config_hash,
        updated_at = CURRENT_TIMESTAMP
    `)

    upsertStmt.run(
      provider.id,
      countryCode,
      isPrimary,
      isTestMode,
      encryptedConfigData,
      configHash
    )
  }

  // =============================================
  // 國家支付配置管理
  // =============================================

  async getCountryConfig(countryCode: CountryCode): Promise<CountryPaymentConfig | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM country_payment_configs 
      WHERE country_code = ?
    `)

    const row = stmt.get(countryCode)
    if (!row) return null

    return {
      country: countryCode,
      currency: row.currency_code,
      supportedMethods: JSON.parse(row.supported_methods),
      primaryProvider: row.primary_provider,
      fallbackProviders: JSON.parse(row.fallback_providers || '[]'),
      minimumAmount: row.minimum_amount,
      maximumAmount: row.maximum_amount,
      taxRate: row.tax_rate,
      processingFeeRate: row.processing_fee_rate
    }
  }

  async getAllCountryConfigs(): Promise<Map<CountryCode, CountryPaymentConfig>> {
    const stmt = this.db.prepare(`
      SELECT * FROM country_payment_configs 
      ORDER BY country_code
    `)

    const rows = stmt.all()
    const configs = new Map<CountryCode, CountryPaymentConfig>()

    for (const row of rows) {
      const config: CountryPaymentConfig = {
        country: row.country_code,
        currency: row.currency_code,
        supportedMethods: JSON.parse(row.supported_methods),
        primaryProvider: row.primary_provider,
        fallbackProviders: JSON.parse(row.fallback_providers || '[]'),
        minimumAmount: row.minimum_amount,
        maximumAmount: row.maximum_amount,
        taxRate: row.tax_rate,
        processingFeeRate: row.processing_fee_rate
      }
      configs.set(row.country_code, config)
    }

    return configs
  }

  async setCountryConfig(config: CountryPaymentConfig): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO country_payment_configs (
        country_code, currency_code, supported_methods, primary_provider,
        fallback_providers, minimum_amount, maximum_amount, tax_rate, processing_fee_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(country_code) DO UPDATE SET
        currency_code = excluded.currency_code,
        supported_methods = excluded.supported_methods,
        primary_provider = excluded.primary_provider,
        fallback_providers = excluded.fallback_providers,
        minimum_amount = excluded.minimum_amount,
        maximum_amount = excluded.maximum_amount,
        tax_rate = excluded.tax_rate,
        processing_fee_rate = excluded.processing_fee_rate,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      config.country,
      config.currency,
      JSON.stringify(config.supportedMethods),
      config.primaryProvider,
      JSON.stringify(config.fallbackProviders),
      config.minimumAmount,
      config.maximumAmount,
      config.taxRate,
      config.processingFeeRate
    )
  }

  // =============================================
  // 支付方式查詢
  // =============================================

  async getSupportedPaymentMethods(countryCode: CountryCode): Promise<PaymentMethod[]> {
    const countryConfig = await this.getCountryConfig(countryCode)
    return countryConfig?.supportedMethods || []
  }

  async getAvailableProviders(
    countryCode: CountryCode, 
    paymentMethod?: PaymentMethod
  ): Promise<PaymentProviderConfig[]> {
    let sql = `
      SELECT pp.* FROM payment_providers pp
      WHERE pp.is_active = 1 
      AND json_extract(pp.supported_countries, '$') LIKE ?
    `
    const params: any[] = [`%"${countryCode}"%`]

    if (paymentMethod) {
      sql += ` AND json_extract(pp.supported_methods, '$') LIKE ?`
      params.push(`%"${paymentMethod}"%`)
    }

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params)

    return rows.map((row: any) => ({
      name: row.name,
      displayName: row.display_name,
      isActive: Boolean(row.is_active),
      supportedCountries: JSON.parse(row.supported_countries),
      supportedMethods: JSON.parse(row.supported_methods),
      testMode: Boolean(row.test_mode),
      config: {},
      webhookEndpoint: row.webhook_endpoint
    }))
  }

  // =============================================
  // 工具方法
  // =============================================

  private generateConfigHash(configData: string): string {
    // 簡單的 hash 生成，實際應該使用更安全的算法
    let hash = 0
    for (let i = 0; i < configData.length; i++) {
      const char = configData.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 轉換為 32 位整數
    }
    return hash.toString(36)
  }

  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // 檢查每個國家都有主要提供商
    const countryConfigs = await this.getAllCountryConfigs()
    for (const [country, config] of countryConfigs) {
      const provider = await this.getPaymentProvider(config.primaryProvider)
      if (!provider) {
        errors.push(`Country ${country} primary provider '${config.primaryProvider}' not found`)
      } else if (!provider.supportedCountries.includes(country)) {
        errors.push(`Provider '${config.primaryProvider}' does not support country ${country}`)
      }

      // 檢查備用提供商
      for (const fallbackProvider of config.fallbackProviders) {
        const provider = await this.getPaymentProvider(fallbackProvider)
        if (!provider) {
          errors.push(`Country ${country} fallback provider '${fallbackProvider}' not found`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}