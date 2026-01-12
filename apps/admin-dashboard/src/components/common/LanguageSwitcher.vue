<template>
  <div class="language-switcher">
    <button class="language-button" :class="{ active: isOpen }" @click="toggleDropdown">
      <span class="flag">{{ currentLocaleConfig.flag }}</span>
      <span class="name">{{ currentLocaleConfig.name }}</span>
      <span class="arrow" :class="{ rotated: isOpen }">▼</span>
    </button>

    <transition name="dropdown">
      <div v-if="isOpen" class="language-dropdown">
        <div
          v-for="localeItem in supportedLocales"
          :key="localeItem.code"
          class="language-option"
          :class="{ active: localeItem.code === currentLocale }"
          @click="selectLocale(localeItem.code)"
        >
          <span class="flag">{{ localeItem.flag }}</span>
          <span class="name">{{ localeItem.name }}</span>
          <span v-if="localeItem.code === currentLocale" class="check">✓</span>
        </div>
      </div>
    </transition>

    <!-- 點擊外部關閉下拉選單 -->
    <div v-if="isOpen" class="overlay" @click="closeDropdown"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '@/i18n'

const { locale, switchLocale, supportedLocales } = useI18n()

const isOpen = ref(false)
const currentLocale = computed(() => locale.value)
const currentLocaleConfig = computed(() => {
  return supportedLocales.find(l => l.code === locale.value) || supportedLocales[0]
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectLocale = async (localeCode: string) => {
  try {
    await switchLocale(localeCode as any)
    closeDropdown()
  } catch (error) {
    console.error('Failed to switch locale:', error)
  }
}

// 點擊外部關閉
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.language-switcher')) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.language-switcher {
  position: relative;
  display: inline-block;
}

.language-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.language-button:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.language-button.active {
  background: #f3f4f6;
  border-color: #3b82f6;
}

.language-button .flag {
  font-size: 20px;
  line-height: 1;
}

.language-button .name {
  font-weight: 500;
}

.language-button .arrow {
  font-size: 10px;
  color: #9ca3af;
  transition: transform 0.2s ease;
}

.language-button .arrow.rotated {
  transform: rotate(180deg);
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  z-index: 1000;
  overflow: hidden;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #374151;
  position: relative;
}

.language-option:hover {
  background: #f3f4f6;
}

.language-option.active {
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 500;
}

.language-option .flag {
  font-size: 18px;
  line-height: 1;
}

.language-option .name {
  flex: 1;
}

.language-option .check {
  font-size: 14px;
  color: #3b82f6;
  font-weight: bold;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
}

/* 動畫效果 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* 響應式設計 */
@media (max-width: 768px) {
  .language-button {
    padding: 6px 12px;
    font-size: 13px;
  }

  .language-button .name {
    display: none;
  }

  .language-dropdown {
    right: auto;
    left: 0;
  }
}
</style>
