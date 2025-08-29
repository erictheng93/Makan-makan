import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import { setupGlobalErrorHandler, errorHandler } from '@/utils/errorHandler'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import './assets/css/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 註冊全局組件
app.component('ErrorDisplay', ErrorDisplay)

// 設置全局錯誤處理
setupGlobalErrorHandler()

// 全局錯誤處理 (Vue 特定錯誤)
app.config.errorHandler = (error: any, instance, info) => {
  console.error('Vue error:', error, info)
  
  // 使用錯誤處理器處理 Vue 錯誤
  errorHandler.handleError(error, {
    type: 'vue_error',
    component: instance?.$?.type?.name || 'unknown',
    errorInfo: info
  })
}

// 全局警告處理 (開發模式)
if (import.meta.env.DEV) {
  app.config.warnHandler = (msg, instance, trace) => {
    console.warn('Vue warning:', msg, trace)
  }
}

app.mount('#app')