<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAIAnalytics } from '@/composables/useAIAnalytics'
import type { LLMProvider } from '@makanmakan/ai-analytics'

// Icons (using heroicons)
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline'
import ShieldCheckIcon from '@heroicons/vue/24/outline/ShieldCheckIcon'

const {
  getConfig,
  saveConfig,
  testProvider,
  getAvailableModels
} = useAIAnalytics()

// Form state
const form = ref({
  provider: 'anthropic' as LLMProvider,
  apiKey: '',
  model: '',
  customBaseUrl: '',
})

const availableModels = ref<string[]>([])
const testResult = ref<{ success: boolean; latency?: number; error?: string } | null>(null)
const isTesting = ref(false)
const isSaving = ref(false)
const saveSuccess = ref(false)
const saveError = ref<string | null>(null)

// Mock restaurant ID (should come from store/context)
const restaurantId = ref('rest_123')

// Provider options with descriptions
const providers = [
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    description: '強大的推理能力，適合深度分析',
    icon: '🤖',
  },
  {
    value: 'openai',
    label: 'OpenAI GPT',
    description: '通用性強，生態完善',
    icon: '✨',
  },
  {
    value: 'google',
    label: 'Google Gemini',
    description: '多模態支持，快速響應',
    icon: '🔮',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    description: '成本效益高，中文友好',
    icon: '🚀',
  },
  {
    value: 'custom',
    label: '自定義 Provider',
    description: 'OpenAI 兼容的自定義服務',
    icon: '⚙️',
  },
]

const selectedProvider = computed(() =>
  providers.find(p => p.value === form.value.provider)
)

// Load configuration on mount
onMounted(async () => {
  const config = await getConfig(restaurantId.value)
  if (config?.config) {
    form.value.provider = config.config.provider
    form.value.model = config.config.model || ''
    form.value.customBaseUrl = config.config.custom_base_url || ''
    // Don't load API key for security
  }
  await loadAvailableModels()
})

// Load available models when provider changes
const onProviderChange = async () => {
  form.value.model = ''
  await loadAvailableModels()
}

const loadAvailableModels = async () => {
  const models = await getAvailableModels(form.value.provider)
  availableModels.value = models
  if (models.length > 0 && !form.value.model) {
    form.value.model = models[0]
  }
}

// Test connection
const handleTestConnection = async () => {
  if (!form.value.apiKey) {
    testResult.value = { success: false, error: '請輸入 API Key' }
    return
  }

  isTesting.value = true
  testResult.value = null

  const result = await testProvider({
    provider: form.value.provider,
    apiKey: form.value.apiKey,
    model: form.value.model || undefined,
    baseUrl: form.value.customBaseUrl || undefined,
  })

  testResult.value = result
  isTesting.value = false
}

// Save configuration
const handleSaveConfig = async () => {
  if (!form.value.apiKey) {
    saveError.value = '請輸入 API Key'
    return
  }

  isSaving.value = true
  saveSuccess.value = false
  saveError.value = null

  try {
    const result = await saveConfig({
      restaurantId: restaurantId.value,
      provider: form.value.provider,
      apiKey: form.value.apiKey,
      model: form.value.model || undefined,
      customBaseUrl: form.value.customBaseUrl || undefined,
    })

    if (result.success) {
      saveSuccess.value = true
      setTimeout(() => {
        saveSuccess.value = false
      }, 3000)
    } else {
      saveError.value = result.message || '保存配置失敗'
    }
  } catch (err) {
    console.error('Save config error:', err)
    saveError.value = err instanceof Error ? err.message : '保存配置時發生錯誤'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center space-x-3 mb-2">
          <SparklesIcon class="w-8 h-8 text-indigo-600" />
          <h1 class="text-3xl font-bold text-gray-900">AI 分析配置</h1>
        </div>
        <p class="text-gray-600 mb-4">
          配置您的 AI Provider，開啟智能業務分析
        </p>

        <!-- Quick Navigation -->
        <div class="flex items-center space-x-2 bg-white rounded-xl p-2 border border-gray-100 w-fit">
          <router-link
            to="/dashboard/ai-analytics/insights"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:bg-gray-100"
          >
            AI 洞察
          </router-link>
          <router-link
            to="/dashboard/ai-analytics/products"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:bg-gray-100"
          >
            產品分析
          </router-link>
          <router-link
            to="/dashboard/ai-analytics/config"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-indigo-600 text-white"
          >
            AI 配置
          </router-link>
        </div>
      </div>

      <!-- Main Config Card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Provider Selection -->
        <div class="p-8 border-b border-gray-100">
          <label class="block text-sm font-semibold text-gray-900 mb-4">
            選擇 AI Provider
          </label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              v-for="provider in providers"
              :key="provider.value"
              type="button"
              class="relative flex items-start p-4 border-2 rounded-xl transition-all duration-200 hover:border-indigo-300 hover:shadow-sm"
              :class="form.provider === provider.value
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 bg-white'"
              @click="form.provider = provider.value as LLMProvider; onProviderChange()"
            >
              <div class="flex-shrink-0 text-2xl mr-3">{{ provider.icon }}</div>
              <div class="flex-1 text-left">
                <div class="font-semibold text-gray-900">{{ provider.label }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ provider.description }}</div>
              </div>
              <CheckCircleIcon
                v-if="form.provider === provider.value"
                class="w-5 h-5 text-indigo-600 absolute top-4 right-4"
              />
            </button>
          </div>
        </div>

        <!-- Configuration Form -->
        <div class="p-8 space-y-6">
          <!-- Selected Provider Info -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 flex items-center space-x-3">
            <div class="text-2xl">{{ selectedProvider?.icon }}</div>
            <div>
              <div class="font-semibold text-gray-900">{{ selectedProvider?.label }}</div>
              <div class="text-sm text-gray-600">{{ selectedProvider?.description }}</div>
            </div>
          </div>

          <!-- API Key Input -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">
              API Key
            </label>
            <div class="relative">
              <ShieldCheckIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="form.apiKey"
                type="password"
                placeholder="請輸入 API Key"
                class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <p class="text-xs text-gray-500 mt-2">
              您的 API Key 將使用 AES-256 加密存儲
            </p>
          </div>

          <!-- Model Selection -->
          <div v-if="availableModels.length > 0">
            <label class="block text-sm font-semibold text-gray-900 mb-2">
              模型選擇
            </label>
            <select
              v-model="form.model"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option v-for="model in availableModels" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
          </div>

          <!-- Custom Base URL (for custom provider) -->
          <div v-if="form.provider === 'custom'">
            <label class="block text-sm font-semibold text-gray-900 mb-2">
              Base URL
            </label>
            <input
              v-model="form.customBaseUrl"
              type="url"
              placeholder="https://your-api-endpoint.com"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <!-- Test Result -->
          <div v-if="testResult" class="rounded-xl p-4 flex items-center space-x-3 transition-all"
               :class="testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
            <CheckCircleIcon v-if="testResult.success" class="w-6 h-6 text-green-600" />
            <XCircleIcon v-else class="w-6 h-6 text-red-600" />
            <div class="flex-1">
              <div class="font-semibold" :class="testResult.success ? 'text-green-900' : 'text-red-900'">
                {{ testResult.success ? '連接成功' : '連接失敗' }}
              </div>
              <div class="text-sm" :class="testResult.success ? 'text-green-700' : 'text-red-700'">
                {{ testResult.success
                  ? `響應延遲: ${testResult.latency}ms`
                  : testResult.error || '請檢查 API Key 和網絡連接' }}
              </div>
            </div>
          </div>

          <!-- Save Success Message -->
          <div v-if="saveSuccess" class="rounded-xl p-4 bg-green-50 border border-green-200 flex items-center space-x-3 animate-fade-in">
            <CheckCircleIcon class="w-6 h-6 text-green-600" />
            <div class="text-green-900 font-semibold">配置已成功保存</div>
          </div>

          <!-- Save Error Message -->
          <div v-if="saveError" class="rounded-xl p-4 bg-red-50 border border-red-200 flex items-center space-x-3 animate-fade-in">
            <XCircleIcon class="w-6 h-6 text-red-600" />
            <div class="flex-1">
              <div class="text-red-900 font-semibold mb-1">保存失敗</div>
              <div class="text-red-700 text-sm">{{ saveError }}</div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex space-x-3 pt-4">
            <button
              :disabled="isTesting || !form.apiKey"
              class="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              @click="handleTestConnection"
            >
              <ArrowPathIcon
                class="w-5 h-5 inline mr-2"
                :class="{ 'animate-spin': isTesting }"
              />
              {{ isTesting ? '測試中...' : '測試連接' }}
            </button>

            <button
              :disabled="isSaving || !form.apiKey"
              class="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/30"
              @click="handleSaveConfig"
            >
              {{ isSaving ? '保存中...' : '保存配置' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-sm font-semibold text-gray-900 mb-1">🔒 安全加密</div>
          <div class="text-xs text-gray-600">API Key 使用 AES-256 加密存儲</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-sm font-semibold text-gray-900 mb-1">📊 使用追蹤</div>
          <div class="text-xs text-gray-600">自動記錄 Token 使用量和成本</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-sm font-semibold text-gray-900 mb-1">⚡ 智能緩存</div>
          <div class="text-xs text-gray-600">6 小時緩存減少 API 調用</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
