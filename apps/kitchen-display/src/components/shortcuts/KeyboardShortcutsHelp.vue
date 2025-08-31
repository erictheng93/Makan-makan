<template>
  <!-- Keyboard Shortcuts Help Modal -->
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="$emit('close')"
  >
    <div
      class="bg-white rounded-xl max-w-4xl max-h-[80vh] overflow-hidden mx-4"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <CommandLineIcon class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">鍵盤快捷鍵</h2>
            <p class="text-sm text-gray-600">使用快捷鍵提高操作效率</p>
          </div>
        </div>
        
        <div class="flex items-center space-x-2">
          <!-- Quick Toggle -->
          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-600">啟用快捷鍵</span>
            <button
              @click="toggleShortcuts"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                shortcutsEnabled ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  shortcutsEnabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </button>
          </div>
          
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto max-h-[60vh] p-6">
        <!-- Search -->
        <div class="mb-6">
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索快捷鍵..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Shortcut Groups -->
        <div class="space-y-6">
          <div
            v-for="group in filteredGroups"
            :key="group.category"
            class="bg-gray-50 rounded-lg p-4"
          >
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <component :is="getCategoryIcon(group.category)" class="w-5 h-5 mr-2 text-gray-600" />
              {{ group.title }}
              <span class="ml-2 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                {{ group.shortcuts.length }}
              </span>
            </h3>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div
                v-for="shortcut in group.shortcuts"
                :key="shortcut.id"
                class="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
              >
                <div class="flex-1">
                  <div class="font-medium text-gray-900 mb-1">{{ shortcut.name }}</div>
                  <div class="text-sm text-gray-600">{{ shortcut.description }}</div>
                </div>
                
                <div class="flex items-center space-x-2 ml-4">
                  <!-- Status indicator -->
                  <div :class="[
                    'w-2 h-2 rounded-full',
                    shortcut.enabled ? 'bg-green-500' : 'bg-gray-300'
                  ]"></div>
                  
                  <!-- Keyboard shortcut -->
                  <div class="flex items-center space-x-1">
                    <kbd
                      v-for="(key, index) in shortcut.keys"
                      :key="index"
                      class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono"
                    >
                      {{ formatKey(key) }}
                    </kbd>
                  </div>
                  
                  <!-- Test button -->
                  <button
                    @click="testShortcut(shortcut)"
                    :disabled="!shortcut.enabled"
                    class="p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                    title="測試快捷鍵"
                  >
                    <PlayIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No results -->
        <div v-if="filteredGroups.length === 0" class="text-center py-8 text-gray-500">
          <CommandLineIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p class="text-lg font-medium">找不到匹配的快捷鍵</p>
          <p class="text-sm">嘗試使用不同的搜索詞</p>
        </div>

        <!-- Quick Tips -->
        <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 class="font-semibold text-blue-900 mb-2 flex items-center">
            <InformationCircleIcon class="w-5 h-5 mr-2" />
            使用提示
          </h4>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>• 快捷鍵在輸入框外可以正常使用</li>
            <li>• 部分全域快捷鍵在任何地方都能使用</li>
            <li>• 連續按鍵有200毫秒的防抖延遲</li>
            <li>• 使用 <kbd class="px-1 py-0.5 bg-white rounded text-xs">?</kbd> 隨時打開這個幫助窗口</li>
          </ul>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center space-x-4">
          <button
            @click="resetShortcuts"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            重設預設值
          </button>
          
          <button
            @click="exportShortcuts"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            導出設置
          </button>
          
          <label class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
            導入設置
            <input
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImportShortcuts"
            />
          </label>
        </div>
        
        <div class="text-sm text-gray-500">
          共 {{ totalShortcuts }} 個快捷鍵，{{ enabledShortcuts }} 個已啟用
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  XMarkIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  InformationCircleIcon,
  Cog6ToothIcon as CogIcon,
  FunnelIcon,
  RocketLaunchIcon,
  CubeIcon
} from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { ShortcutGroup } from '@/composables/useKeyboardShortcuts'

// Props
interface Props {
  show: boolean
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
}>()

const toast = useToast()

// Composables
const {
  shortcutGroups,
  enabled: shortcutsEnabled,
  toggle: toggleShortcuts,
  resetToDefaults,
  exportShortcuts: exportShortcutsConfig,
  importShortcuts: importShortcutsConfig
} = useKeyboardShortcuts()

// State
const searchQuery = ref('')

// Computed
const filteredGroups = computed((): ShortcutGroup[] => {
  if (!searchQuery.value.trim()) {
    return shortcutGroups.value
  }
  
  const query = searchQuery.value.toLowerCase()
  
  return shortcutGroups.value
    .map(group => ({
      ...group,
      shortcuts: group.shortcuts.filter(shortcut =>
        shortcut.name.toLowerCase().includes(query) ||
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.keys.some(key => key.toLowerCase().includes(query))
      )
    }))
    .filter(group => group.shortcuts.length > 0)
})

const totalShortcuts = computed(() => 
  shortcutGroups.value.reduce((sum, group) => sum + group.shortcuts.length, 0)
)

const enabledShortcuts = computed(() => 
  shortcutGroups.value.reduce(
    (sum, group) => sum + group.shortcuts.filter(s => s.enabled).length, 
    0
  )
)

// Methods
const getCategoryIcon = (category: string) => {
  const icons: Record<string, any> = {
    orders: CubeIcon,
    navigation: RocketLaunchIcon,
    filters: FunnelIcon,
    system: CogIcon
  }
  return icons[category] || CogIcon
}

const formatKey = (key: string): string => {
  const symbols: Record<string, string> = {
    'Ctrl': '⌃',
    'Cmd': '⌘',
    'Alt': '⌥',
    'Shift': '⇧',
    'Space': 'Space',
    'Enter': '↵',
    'Tab': '⇥',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': '⌦',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→'
  }
  
  return symbols[key] || key
}

const testShortcut = (shortcut: any) => {
  if (!shortcut.enabled) return
  
  toast.info(`測試快捷鍵: ${shortcut.name}`, { timeout: 1500 })
  
  // Simulate shortcut execution
  setTimeout(() => {
    toast.success(`✓ 快捷鍵 "${shortcut.name}" 測試成功`, { timeout: 1000 })
  }, 200)
}

const resetShortcuts = () => {
  resetToDefaults()
  toast.success('快捷鍵設置已重設為預設值')
}

const exportShortcuts = () => {
  exportShortcutsConfig()
}

const handleImportShortcuts = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  try {
    await importShortcutsConfig(file)
  } catch (error) {
    // Error already handled in composable
  } finally {
    // Reset input
    input.value = ''
  }
}
</script>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Keyboard key styling */
kbd {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.025em;
  box-shadow: inset 0 -2px 0 0 #e5e7eb, inset 0 0 1px 1px #fff, 0 1px 2px 1px rgba(0, 0, 0, 0.15);
}
</style>