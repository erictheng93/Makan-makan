# Bundle Size Optimization Guide

## Overview

This guide documents the bundle size optimization strategies implemented in MakanMakan to improve initial load performance and reduce bandwidth usage.

**Implementation Date**: 2025-10-02
**Phase**: Week 3 - Medium Priority (Performance & Scalability)

---

## Summary of Optimizations

### Admin Dashboard
- **Code Splitting**: Granular chunking of Vue ecosystem, UI libraries, charting libraries
- **Lazy Loading**: All routes use `() => import()` pattern
- **Bundle Analyzer**: Integrated `rollup-plugin-visualizer`
- **Dynamic Components**: `useDynamicComponents` composable with retry logic
- **Tree Shaking**: Excludes heavy libraries from pre-bundling

### Customer App (PWA)
- **Advanced Chunking**: Separate chunks for PWA components (workbox, idb)
- **QR Library Optimization**: Lazy load @zxing/library (large bundle)
- **PWA-Aware Loading**: Network-adaptive and offline-aware component loading
- **Image Optimization**: Lazy loading with Intersection Observer
- **Service Worker Caching**: Strategic caching of code chunks

---

## Implemented Features

### 1. Advanced Code Splitting

#### Admin Dashboard (`apps/admin-dashboard/vite.config.ts`)

```typescript
manualChunks: (id) => {
  // Vue core ecosystem (shared across all pages)
  if (id.includes('vue/') || id.includes('@vue/')) return 'vue-core'
  if (id.includes('vue-router/')) return 'vue-router'
  if (id.includes('pinia/')) return 'pinia'

  // UI libraries (used in many components)
  if (id.includes('@headlessui/vue')) return 'headlessui'
  if (id.includes('@heroicons/vue')) return 'heroicons'
  if (id.includes('lucide-vue-next')) return 'lucide'
  if (id.includes('vue-toastification')) return 'toastification'

  // Heavy charting libraries (lazy load)
  if (id.includes('chart.js')) return 'chartjs'
  if (id.includes('vue-chartjs')) return 'vue-chartjs'

  // i18n
  if (id.includes('vue-i18n')) return 'i18n'

  // Utils
  if (id.includes('axios')) return 'axios'
  if (id.includes('lodash-es')) return 'lodash'
  if (id.includes('date-fns')) return 'date-fns'
  if (id.includes('@vueuse/core')) return 'vueuse'

  // Remaining vendor code
  if (id.includes('node_modules/')) return 'vendor'
}
```

**Expected Benefits**:
- **Initial Load**: 30-40% reduction in initial bundle size
- **Caching**: Better long-term caching (vendor chunks rarely change)
- **Parallel Loading**: Browser can download multiple chunks simultaneously

#### Customer App (`apps/customer-app/vite.config.ts`)

```typescript
manualChunks: (id) => {
  // Vue core
  if (id.includes('vue/') || id.includes('@vue/')) return 'vue-core'
  if (id.includes('vue-router/')) return 'vue-router'
  if (id.includes('pinia/')) return 'pinia'

  // UI libraries
  if (id.includes('@headlessui/vue')) return 'headlessui'
  if (id.includes('@heroicons/vue')) return 'heroicons'

  // Utils
  if (id.includes('axios')) return 'axios'
  if (id.includes('dayjs')) return 'dayjs'

  // QR code libraries (heavy - lazy load)
  if (id.includes('@zxing/library')) return 'zxing-qr'
  if (id.includes('qrcode-reader')) return 'qrcode-reader'

  // PWA-specific chunks
  if (id.includes('workbox-')) return 'workbox'
  if (id.includes('idb')) return 'idb'

  // VueUse composables
  if (id.includes('@vueuse/core')) return 'vueuse'

  // TanStack Query
  if (id.includes('@tanstack/vue-query')) return 'tanstack-query'

  // Remaining vendor code
  if (id.includes('node_modules/')) return 'vendor'
}
```

**Expected Benefits**:
- **PWA Performance**: Faster subsequent loads with cached chunks
- **Mobile Optimization**: Reduced bandwidth usage on 3G/4G
- **Offline Support**: Service Worker can cache individual chunks

---

### 2. Dynamic Component Loading

Created `useDynamicComponents.ts` composable for both apps with advanced features:

#### Features

**1. Basic Lazy Loading**
```typescript
const HeavyChart = useLazyComponent(
  () => import('@/components/charts/HeavyChart.vue'),
  {
    delay: 200,
    timeout: 10000
  }
)
```

**2. Component Preloading**
```typescript
// Preload analytics components when dashboard is mounted
onMounted(() => {
  preloadComponent(() => import('@/views/AnalyticsView.vue'))
})
```

**3. Visibility-Based Loading (Intersection Observer)**
```typescript
const HeavyTable = useVisibilityComponent(
  elementRef,
  () => import('@/components/HeavyTable.vue')
)
```

**4. Batch Component Loading**
```typescript
const chartComponents = useBatchLoader({
  LineChart: () => import('@/components/charts/LineChart.vue'),
  BarChart: () => import('@/components/charts/BarChart.vue'),
  PieChart: () => import('@/components/charts/PieChart.vue')
})
```

**5. Performance Metrics**
```typescript
const HeavyComponent = useLazyComponentWithMetrics(
  'HeavyComponent',
  () => import('@/components/Heavy.vue')
)
// Automatically logs: "[ComponentMetrics] HeavyComponent loaded in 123.45ms"
```

#### Customer App PWA-Specific Features

**1. Offline-Aware Loading**
```typescript
// Automatically retries when device comes back online
const Component = useLazyComponent(
  () => import('@/components/MyComponent.vue')
)
```

**2. Network-Adaptive Loading**
```typescript
// Loads light version on slow 2G/3G connections
const AdaptiveComponent = useAdaptiveComponent(
  () => import('@/components/LightVersion.vue'),
  () => import('@/components/HeavyVersion.vue')
)
```

**3. Service Worker Integration**
```typescript
// Uses Service Worker cache if available
preloadComponent(() => import('@/views/MenuView.vue'))
```

---

### 3. Bundle Analyzer Integration

#### Usage

**Admin Dashboard**:
```bash
cd apps/admin-dashboard
npm run build:analyze
# Opens ./dist/stats.html with interactive bundle visualization
```

**Customer App**:
```bash
cd apps/customer-app
npm run build:analyze
# Opens ./dist/stats.html with interactive bundle visualization
```

#### What to Look For

1. **Large Chunks**: Identify chunks > 500KB that can be split further
2. **Duplicate Code**: Look for the same library loaded multiple times
3. **Unused Dependencies**: Libraries that increase bundle size but aren't used
4. **Tree Shaking Failures**: Entire libraries loaded when only small parts are used

#### Example Analysis

```
✓ built in 12.34s
dist/stats.html generated (bundle analyzer)

Largest chunks:
- chartjs.js          234 KB (gzipped: 78 KB)
- vue-core.js         187 KB (gzipped: 62 KB)
- vendor.js           156 KB (gzipped: 51 KB)
- vue-router.js        89 KB (gzipped: 29 KB)
- headlessui.js        67 KB (gzipped: 22 KB)
```

---

### 4. Optimization Best Practices

#### Route-Level Code Splitting

**Already Implemented** - All routes use lazy loading:

```typescript
// Admin Dashboard
{
  path: "/analytics",
  name: "Analytics",
  component: () => import("@/views/AnalyticsView.vue")
}

// Customer App
{
  path: "/restaurant/:restaurantId/table/:tableId",
  name: "RestaurantMenu",
  component: () => import("@/views/MenuView.vue")
}
```

#### Component-Level Code Splitting

**Usage Example**:

```vue
<script setup lang="ts">
import { useLazyComponent } from '@/composables/useDynamicComponents'

// Lazy load heavy chart component only when needed
const AnalyticsChart = useLazyComponent(
  () => import('@/components/charts/AnalyticsChart.vue'),
  { delay: 200 }
)

// Preload on hover for instant display on click
const handleMouseEnter = () => {
  preloadComponent(() => import('@/components/charts/AnalyticsChart.vue'))
}
</script>

<template>
  <button @mouseenter="handleMouseEnter">
    Show Analytics
  </button>
  <Suspense>
    <AnalyticsChart v-if="showChart" />
  </Suspense>
</template>
```

#### Library-Specific Optimizations

**Chart.js Optimization**:
```typescript
// Import only needed components instead of entire library
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)
```

**Lodash Optimization**:
```typescript
// ❌ Bad: Imports entire lodash library
import _ from 'lodash'

// ✅ Good: Import only what you need
import debounce from 'lodash-es/debounce'
import throttle from 'lodash-es/throttle'
```

**Date Library Optimization**:
```typescript
// ❌ Bad: Import entire dayjs with all locales
import dayjs from 'dayjs'

// ✅ Good: Import only needed plugins
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

dayjs.extend(relativeTime)
dayjs.extend(utc)
```

---

## Performance Targets

### Admin Dashboard

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Initial Bundle Size | < 300 KB | TBD | 🟡 In Progress |
| Time to Interactive | < 3s | TBD | 🟡 In Progress |
| First Contentful Paint | < 1.5s | TBD | 🟡 In Progress |
| Largest Chunk | < 150 KB | TBD | 🟡 In Progress |

### Customer App (PWA)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Initial Bundle Size | < 200 KB | TBD | 🟡 In Progress |
| Time to Interactive | < 2s | TBD | 🟡 In Progress |
| First Contentful Paint | < 1s | TBD | 🟡 In Progress |
| Lighthouse Score | > 90 | 95 | ✅ Complete |

---

## Monitoring and Continuous Improvement

### Bundle Size Monitoring

**CI/CD Integration**:
```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: cd apps/admin-dashboard && pnpm run build
      - run: cd apps/customer-app && pnpm run build
      # Fail if bundle size increases > 10%
      - uses: andresz1/size-limit-action@v1
        with:
          threshold: 10%
```

### Performance Monitoring

**Real User Monitoring (RUM)**:
```typescript
// Track component load times in production
if (import.meta.env.PROD) {
  const metrics = useComponentMetrics('HeavyComponent')

  // Send to analytics
  const { loadTime, success } = metrics.getMetrics()[0]
  analytics.track('component_load', {
    component: 'HeavyComponent',
    loadTime,
    success
  })
}
```

---

## Verification Steps

### 1. Build Analysis

```bash
# Admin Dashboard
cd apps/admin-dashboard
npm run build:analyze

# Customer App
cd apps/customer-app
npm run build:analyze
```

**Expected Output**:
- Bundle visualization opens in browser
- Verify chunks are properly split
- Check for duplicate dependencies
- Identify optimization opportunities

### 2. Network Analysis

1. Open DevTools → Network tab
2. Throttle to "Fast 3G"
3. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
4. Verify:
   - Initial HTML loads quickly
   - JS chunks load in parallel
   - Code splits trigger on route navigation

### 3. Production Build Size

```bash
# Check compressed sizes
cd apps/admin-dashboard/dist && find . -name "*.js" -exec gzip -9 -c {} \; | wc -c
cd apps/customer-app/dist && find . -name "*.js" -exec gzip -9 -c {} \; | wc -c
```

### 4. Lighthouse Audit

```bash
# Customer App (PWA)
cd apps/customer-app
npm run build
npm run preview
# Open Chrome DevTools → Lighthouse → Run audit
```

**Target Scores**:
- Performance: > 90
- Best Practices: > 95
- Accessibility: > 90
- SEO: > 90
- PWA: 100

---

## Common Issues and Solutions

### Issue 1: Chunk Size Still Large After Splitting

**Cause**: Heavy dependencies not properly split

**Solution**:
```typescript
// In vite.config.ts
optimizeDeps: {
  exclude: ['heavy-library']
}

// Create dedicated chunk
if (id.includes('heavy-library')) {
  return 'heavy-library-chunk'
}
```

### Issue 2: Duplicate Code in Multiple Chunks

**Cause**: Shared dependencies not extracted to common chunk

**Solution**:
```typescript
// In vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        // Extract shared utilities
        if (id.includes('/utils/') && id.includes('node_modules')) {
          return 'shared-utils'
        }
      }
    }
  }
}
```

### Issue 3: Lazy Loading Not Working

**Cause**: Component eagerly imported elsewhere

**Solution**:
```typescript
// ❌ Bad: Eager import defeats lazy loading
import HeavyComponent from '@/components/Heavy.vue'

// ✅ Good: Use dynamic import everywhere
const HeavyComponent = useLazyComponent(
  () => import('@/components/Heavy.vue')
)
```

---

## Future Enhancements

### Planned Improvements

1. **HTTP/2 Server Push**: Preload critical chunks
2. **Resource Hints**: `<link rel="preload">` for above-the-fold components
3. **Module Preloading**: Use `<link rel="modulepreload">` for next-route chunks
4. **Differential Serving**: Modern bundles for ES2020+, legacy for older browsers
5. **WebAssembly**: Move heavy computations to WASM modules

### Experimental Features

1. **Webpack Module Federation**: Share dependencies across micro-frontends
2. **Vite Plugin for Auto-Splitting**: Automatic component splitting based on size
3. **AI-Powered Bundling**: Machine learning to predict optimal chunk boundaries

---

## Resources

### Documentation
- [Vite Code Splitting](https://vitejs.dev/guide/build.html#chunking-strategy)
- [Vue 3 Async Components](https://vuejs.org/guide/components/async.html)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)

### Tools
- [Rollup Plugin Visualizer](https://github.com/btd/rollup-plugin-visualizer)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

### Related Guides
- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Overall performance strategies
- `PWA-TESTING-REPORT.md` - PWA-specific optimizations

---

**Last Updated**: 2025-10-02
**Maintained By**: MakanMakan Development Team
