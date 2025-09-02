// Feature toggle and configuration management service
import { ref, watch } from 'vue'
import { errorReportingService } from './errorReportingService'

export interface FeatureFlag {
  key: string
  name: string
  description: string
  enabled: boolean
  category: 'core' | 'experimental' | 'beta' | 'deprecated'
  dependencies?: string[]
  restrictions?: {
    userRoles?: string[]
    environments?: string[]
    percentage?: number // Gradual rollout percentage
  }
  metadata?: {
    version: string
    createdAt: string
    updatedAt: string
    author?: string
  }
}

export interface Configuration {
  key: string
  name: string
  description: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  category: 'ui' | 'performance' | 'api' | 'audio' | 'system'
  validation?: {
    min?: number
    max?: number
    pattern?: string
    required?: boolean
    options?: any[]
  }
  metadata?: {
    version: string
    createdAt: string
    updatedAt: string
    author?: string
  }
}

export interface ConfigProfile {
  id: string
  name: string
  description: string
  features: Record<string, boolean>
  configurations: Record<string, any>
  active: boolean
  metadata?: {
    version: string
    createdAt: string
    updatedAt: string
    author?: string
  }
}

class FeatureToggleService {
  private readonly STORAGE_KEY = 'kitchen-feature-toggles'
  private readonly CONFIG_KEY = 'kitchen-configurations'
  private readonly PROFILES_KEY = 'kitchen-config-profiles'
  
  // Reactive state
  public features = ref<Record<string, FeatureFlag>>({})
  public configurations = ref<Record<string, Configuration>>({})
  public profiles = ref<Record<string, ConfigProfile>>({})
  public activeProfile = ref<string>('default')
  public initialized = ref(false)

  // Environment and user context
  private environment = ref(import.meta.env.MODE || 'development')
  private userRole = ref('user')
  private userId = ref('')

  constructor() {
    this.initializeDefaults()
    this.loadFromStorage()
    this.setupWatchers()
  }

  // Feature flags methods
  public isFeatureEnabled(featureKey: string): boolean {
    const feature = this.features.value[featureKey]
    if (!feature) return false

    // Check if feature is enabled
    if (!feature.enabled) return false

    // Check dependencies
    if (feature.dependencies) {
      for (const dependency of feature.dependencies) {
        if (!this.isFeatureEnabled(dependency)) {
          return false
        }
      }
    }

    // Check restrictions
    if (feature.restrictions) {
      // Environment restriction
      if (feature.restrictions.environments && 
          !feature.restrictions.environments.includes(this.environment.value)) {
        return false
      }

      // User role restriction
      if (feature.restrictions.userRoles && 
          !feature.restrictions.userRoles.includes(this.userRole.value)) {
        return false
      }

      // Percentage rollout
      if (feature.restrictions.percentage !== undefined) {
        const userHash = this.hashUserId(this.userId.value)
        const rolloutPercentage = userHash % 100
        if (rolloutPercentage >= feature.restrictions.percentage) {
          return false
        }
      }
    }

    return true
  }

  public enableFeature(featureKey: string): void {
    const feature = this.features.value[featureKey]
    if (feature) {
      feature.enabled = true
      feature.metadata = {
        version: feature.metadata?.version || '1.0.0',
        createdAt: feature.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: feature.metadata?.author
      }
      this.saveToStorage()
    }
  }

  public disableFeature(featureKey: string): void {
    const feature = this.features.value[featureKey]
    if (feature) {
      feature.enabled = false
      feature.metadata = {
        version: feature.metadata?.version || '1.0.0',
        createdAt: feature.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: feature.metadata?.author
      }
      this.saveToStorage()
    }
  }

  public addFeature(feature: FeatureFlag): void {
    feature.metadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...feature.metadata
    }
    
    this.features.value[feature.key] = feature
    this.saveToStorage()
  }

  public updateFeature(featureKey: string, updates: Partial<FeatureFlag>): void {
    const feature = this.features.value[featureKey]
    if (feature) {
      Object.assign(feature, updates)
      feature.metadata = {
        version: feature.metadata?.version || '1.0.0',
        createdAt: feature.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: feature.metadata?.author
      }
      this.saveToStorage()
    }
  }

  public removeFeature(featureKey: string): void {
    delete this.features.value[featureKey]
    this.saveToStorage()
  }

  // Configuration methods
  public getConfiguration<T = any>(configKey: string, defaultValue?: T): T {
    const config = this.configurations.value[configKey]
    if (!config) {
      return defaultValue as T
    }

    // Apply profile override if exists
    const profile = this.getCurrentProfile()
    if (profile && profile.configurations[configKey] !== undefined) {
      return profile.configurations[configKey] as T
    }

    return config.value as T
  }

  public setConfiguration<T = any>(configKey: string, value: T): boolean {
    const config = this.configurations.value[configKey]
    if (!config) return false

    // Validate value
    if (!this.validateConfigValue(config, value)) {
      return false
    }

    config.value = value
    config.metadata = {
      version: config.metadata?.version || '1.0.0',
      createdAt: config.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: config.metadata?.author
    }
    
    this.saveToStorage()
    return true
  }

  public addConfiguration(configuration: Configuration): void {
    configuration.metadata = {
      version: configuration.metadata?.version || '1.0.0',
      createdAt: configuration.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: configuration.metadata?.author
    }
    
    this.configurations.value[configuration.key] = configuration
    this.saveToStorage()
  }

  public updateConfiguration(configKey: string, updates: Partial<Configuration>): void {
    const config = this.configurations.value[configKey]
    if (config) {
      Object.assign(config, updates)
      config.metadata = {
        version: config.metadata?.version || '1.0.0',
        createdAt: config.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: config.metadata?.author
      }
      this.saveToStorage()
    }
  }

  public removeConfiguration(configKey: string): void {
    delete this.configurations.value[configKey]
    this.saveToStorage()
  }

  // Profile methods
  public createProfile(profile: Omit<ConfigProfile, 'metadata'>): string {
    const profileWithMetadata: ConfigProfile = {
      ...profile,
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
    
    this.profiles.value[profile.id] = profileWithMetadata
    this.saveToStorage()
    return profile.id
  }

  public updateProfile(profileId: string, updates: Partial<ConfigProfile>): void {
    const profile = this.profiles.value[profileId]
    if (profile) {
      Object.assign(profile, updates)
      profile.metadata = {
        version: profile.metadata?.version || '1.0.0',
        createdAt: profile.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: profile.metadata?.author
      }
      this.saveToStorage()
    }
  }

  public activateProfile(profileId: string): boolean {
    const profile = this.profiles.value[profileId]
    if (!profile) return false

    // Deactivate current profile
    const currentProfile = this.getCurrentProfile()
    if (currentProfile) {
      currentProfile.active = false
    }

    // Activate new profile
    profile.active = true
    this.activeProfile.value = profileId
    this.saveToStorage()
    
    return true
  }

  public getCurrentProfile(): ConfigProfile | null {
    return this.profiles.value[this.activeProfile.value] || null
  }

  public deleteProfile(profileId: string): boolean {
    if (profileId === 'default') return false // Cannot delete default profile
    if (profileId === this.activeProfile.value) return false // Cannot delete active profile

    delete this.profiles.value[profileId]
    this.saveToStorage()
    return true
  }

  // Import/Export methods
  public exportConfiguration(): string {
    const exportData = {
      features: this.features.value,
      configurations: this.configurations.value,
      profiles: this.profiles.value,
      activeProfile: this.activeProfile.value,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }
    
    return JSON.stringify(exportData, null, 2)
  }

  public async importConfiguration(data: string): Promise<boolean> {
    try {
      const importData = JSON.parse(data)
      
      // Validate import data structure
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data structure')
      }

      // Backup current configuration
      const backup = this.exportConfiguration()
      localStorage.setItem(`${this.STORAGE_KEY}-backup-${Date.now()}`, backup)

      // Import data
      this.features.value = importData.features || {}
      this.configurations.value = importData.configurations || {}
      this.profiles.value = importData.profiles || {}
      this.activeProfile.value = importData.activeProfile || 'default'

      this.saveToStorage()
      
      return true
    } catch (error) {
      console.error('Failed to import configuration:', error)
      errorReportingService.reportError(error as Error, {
        component: 'feature-toggle-service',
        action: 'import-configuration'
      })
      return false
    }
  }

  // Reset methods
  public resetToDefaults(): void {
    this.features.value = {}
    this.configurations.value = {}
    this.profiles.value = {}
    this.activeProfile.value = 'default'
    
    this.initializeDefaults()
    this.saveToStorage()
  }

  public resetFeatures(): void {
    this.features.value = {}
    this.initializeDefaultFeatures()
    this.saveToStorage()
  }

  public resetConfigurations(): void {
    this.configurations.value = {}
    this.initializeDefaultConfigurations()
    this.saveToStorage()
  }

  // Context methods
  public setUserContext(userId: string, userRole: string): void {
    this.userId.value = userId
    this.userRole.value = userRole
  }

  public setEnvironment(environment: string): void {
    this.environment.value = environment
  }

  // Analytics and insights
  public getFeatureUsageStats(): {
    totalFeatures: number
    enabledFeatures: number
    featuresByCategory: Record<string, number>
    restrictedFeatures: number
  } {
    const features = Object.values(this.features.value)
    
    return {
      totalFeatures: features.length,
      enabledFeatures: features.filter(f => f.enabled).length,
      featuresByCategory: features.reduce((acc, feature) => {
        acc[feature.category] = (acc[feature.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      restrictedFeatures: features.filter(f => f.restrictions).length
    }
  }

  public getConfigurationStats(): {
    totalConfigurations: number
    configsByCategory: Record<string, number>
    configsByType: Record<string, number>
    validatedConfigs: number
  } {
    const configs = Object.values(this.configurations.value)
    
    return {
      totalConfigurations: configs.length,
      configsByCategory: configs.reduce((acc, config) => {
        acc[config.category] = (acc[config.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      configsByType: configs.reduce((acc, config) => {
        acc[config.type] = (acc[config.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      validatedConfigs: configs.filter(c => c.validation).length
    }
  }

  // Private methods
  private initializeDefaults(): void {
    this.initializeDefaultFeatures()
    this.initializeDefaultConfigurations()
    this.initializeDefaultProfiles()
    this.initialized.value = true
  }

  private initializeDefaultFeatures(): void {
    const defaultFeatures: FeatureFlag[] = [
      {
        key: 'workflow_automation',
        name: '工作流自動化',
        description: '自動化訂單分配和進度管理',
        enabled: true,
        category: 'core'
      },
      {
        key: 'audio_notifications',
        name: '音頻通知',
        description: '訂單狀態變更時播放音頻提醒',
        enabled: true,
        category: 'core'
      },
      {
        key: 'keyboard_shortcuts',
        name: '鍵盤快捷鍵',
        description: '使用鍵盤快捷鍵快速操作',
        enabled: true,
        category: 'core'
      },
      {
        key: 'offline_mode',
        name: '離線模式',
        description: '離線狀態下繼續操作並同步',
        enabled: true,
        category: 'core'
      },
      {
        key: 'performance_monitoring',
        name: '性能監控',
        description: '監控系統性能和健康狀態',
        enabled: true,
        category: 'core'
      },
      {
        key: 'drag_drop_interface',
        name: '拖拽介面',
        description: '使用拖拽操作管理訂單',
        enabled: true,
        category: 'experimental'
      },
      {
        key: 'batch_operations',
        name: '批量操作',
        description: '同時操作多個訂單',
        enabled: true,
        category: 'beta'
      },
      {
        key: 'advanced_analytics',
        name: '進階分析',
        description: '詳細的性能和使用分析',
        enabled: false,
        category: 'experimental',
        restrictions: {
          environments: ['development', 'staging'],
          percentage: 50
        }
      }
    ]

    defaultFeatures.forEach(feature => {
      if (!this.features.value[feature.key]) {
        this.addFeature(feature)
      }
    })
  }

  private initializeDefaultConfigurations(): void {
    const defaultConfigurations: Configuration[] = [
      {
        key: 'ui_theme',
        name: 'UI 主題',
        description: '使用者介面主題色彩',
        value: 'light',
        type: 'string',
        category: 'ui',
        validation: {
          options: ['light', 'dark', 'auto']
        }
      },
      {
        key: 'auto_refresh_interval',
        name: '自動重新整理間隔',
        description: '自動重新整理資料的間隔時間（毫秒）',
        value: 30000,
        type: 'number',
        category: 'performance',
        validation: {
          min: 5000,
          max: 300000
        }
      },
      {
        key: 'audio_master_volume',
        name: '主音量',
        description: '音頻通知的主音量',
        value: 0.8,
        type: 'number',
        category: 'audio',
        validation: {
          min: 0,
          max: 1
        }
      },
      {
        key: 'max_concurrent_orders',
        name: '最大併發訂單',
        description: '同時顯示的最大訂單數量',
        value: 50,
        type: 'number',
        category: 'performance',
        validation: {
          min: 10,
          max: 200
        }
      },
      {
        key: 'error_reporting_enabled',
        name: '啟用錯誤報告',
        description: '自動報告系統錯誤',
        value: true,
        type: 'boolean',
        category: 'system'
      },
      {
        key: 'offline_sync_retry_limit',
        name: '離線同步重試次數',
        description: '離線操作同步失敗時的最大重試次數',
        value: 3,
        type: 'number',
        category: 'system',
        validation: {
          min: 1,
          max: 10
        }
      }
    ]

    defaultConfigurations.forEach(config => {
      if (!this.configurations.value[config.key]) {
        this.addConfiguration(config)
      }
    })
  }

  private initializeDefaultProfiles(): void {
    if (!this.profiles.value['default']) {
      this.createProfile({
        id: 'default',
        name: '預設配置',
        description: '系統預設配置檔案',
        features: {},
        configurations: {},
        active: true
      })
    }

    if (!this.profiles.value['performance']) {
      this.createProfile({
        id: 'performance',
        name: '高性能模式',
        description: '優化性能的配置檔案',
        features: {
          workflow_automation: false,
          advanced_analytics: false
        },
        configurations: {
          auto_refresh_interval: 60000,
          max_concurrent_orders: 30
        },
        active: false
      })
    }

    if (!this.profiles.value['development']) {
      this.createProfile({
        id: 'development',
        name: '開發模式',
        description: '開發和測試用的配置檔案',
        features: {
          advanced_analytics: true,
          drag_drop_interface: true
        },
        configurations: {
          error_reporting_enabled: true,
          auto_refresh_interval: 10000
        },
        active: false
      })
    }
  }

  private validateConfigValue(config: Configuration, value: any): boolean {
    if (!config.validation) return true

    const validation = config.validation

    // Required check
    if (validation.required && (value === null || value === undefined || value === '')) {
      return false
    }

    // Type check
    switch (config.type) {
      case 'number':
        if (typeof value !== 'number') return false
        if (validation.min !== undefined && value < validation.min) return false
        if (validation.max !== undefined && value > validation.max) return false
        break

      case 'string':
        if (typeof value !== 'string') return false
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) return false
        break

      case 'boolean':
        if (typeof value !== 'boolean') return false
        break

      case 'array':
        if (!Array.isArray(value)) return false
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
        break
    }

    // Options check
    if (validation.options && !validation.options.includes(value)) {
      return false
    }

    return true
  }

  private validateImportData(data: any): boolean {
    if (typeof data !== 'object' || data === null) return false
    
    // Basic structure validation
    const requiredFields = ['features', 'configurations', 'profiles']
    return requiredFields.every(field => field in data)
  }

  private hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private setupWatchers(): void {
    // Watch for changes and auto-save
    watch([this.features, this.configurations, this.profiles, this.activeProfile], () => {
      if (this.initialized.value) {
        this.saveToStorage()
      }
    }, { deep: true })
  }

  private loadFromStorage(): void {
    try {
      // Load features
      const featuresData = localStorage.getItem(this.STORAGE_KEY)
      if (featuresData) {
        this.features.value = JSON.parse(featuresData)
      }

      // Load configurations
      const configData = localStorage.getItem(this.CONFIG_KEY)
      if (configData) {
        this.configurations.value = JSON.parse(configData)
      }

      // Load profiles
      const profilesData = localStorage.getItem(this.PROFILES_KEY)
      if (profilesData) {
        const parsed = JSON.parse(profilesData)
        this.profiles.value = parsed.profiles || {}
        this.activeProfile.value = parsed.activeProfile || 'default'
      }
    } catch (error) {
      console.error('Failed to load feature toggle data:', error)
      errorReportingService.reportError(error as Error, {
        component: 'feature-toggle-service',
        action: 'load-from-storage'
      })
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.features.value))
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.configurations.value))
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify({
        profiles: this.profiles.value,
        activeProfile: this.activeProfile.value
      }))
    } catch (error) {
      console.error('Failed to save feature toggle data:', error)
      errorReportingService.reportError(error as Error, {
        component: 'feature-toggle-service',
        action: 'save-to-storage'
      })
    }
  }

  public cleanup(): void {
    this.saveToStorage()
  }
}

// Create and export singleton instance
export const featureToggleService = new FeatureToggleService()
export default featureToggleService