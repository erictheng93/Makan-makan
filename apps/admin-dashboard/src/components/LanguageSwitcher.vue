<template>
  <div class="relative">
    <button
      class="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      @click="toggleDropdown"
    >
      <span class="text-lg">{{ currentLocale.flag }}</span>
      <span class="hidden sm:block">{{ currentLocale.name }}</span>
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="dropdownOpen"
        class="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="py-1">
          <button
            v-for="locale in availableLocales"
            :key="locale.code"
            class="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            :class="{
              'bg-gray-50 text-gray-900': locale.code === currentLocale.code
            }"
            @click="switchToLocale(locale.code)"
          >
            <div class="flex items-center space-x-3">
              <span class="text-lg">{{ locale.flag }}</span>
              <div class="flex flex-col items-start">
                <span class="font-medium">{{ locale.name }}</span>
                <span class="text-xs text-gray-500">{{ locale.code }}</span>
              </div>
            </div>
            <CheckIcon v-if="locale.code === currentLocale.code" class="h-4 w-4 text-green-600" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Loading overlay -->
    <div
      v-if="switching"
      class="absolute inset-0 bg-white bg-opacity-75 rounded-md flex items-center justify-center"
    >
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CheckIcon } from '@heroicons/vue/24/solid'
import { useAdminI18n } from '../i18n'
// TODO: Fix i18n types
// import type { SupportedLocale } from '@makanmakan/i18n'
type SupportedLocale = string

// Composables
const { switchLocale, getCurrentLocaleInfo, getAvailableLocales } = useAdminI18n()

// State
const dropdownOpen = ref(false)
const switching = ref(false)

// Computed
const currentLocale = computed(() => getCurrentLocaleInfo())
const availableLocales = computed(() => getAvailableLocales())

// Methods
const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value
}

const switchToLocale = async (locale: SupportedLocale) => {
  if (locale === currentLocale.value.code || switching.value) {
    dropdownOpen.value = false
    return
  }

  switching.value = true

  try {
    const success = await switchLocale()

    if (success) {
      // Emit event for parent components to react
      emit('localeChanged', locale)

      // Close dropdown
      dropdownOpen.value = false

      // Optional: Reload page to ensure all components update
      // window.location.reload()
    } else {
      console.error('Failed to switch locale')
    }
  } catch (error) {
    console.error('Error switching locale:', error)
  } finally {
    switching.value = false
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    dropdownOpen.value = false
  }
}

// Events
const emit = defineEmits<{
  localeChanged: [locale: SupportedLocale]
}>()

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>