# Kitchen Display UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all kitchen-display pages and components to follow the Apple-Native Soft Minimalism design system with kitchen-optimized high-contrast adaptations (Kitchen Pro approach).

**Architecture:** Pure UI redesign — all business logic (stores, services, composables, API) remains unchanged. Only Vue component templates/styles and Tailwind config are modified. The two dashboard views (EnhancedKitchenDashboard + KitchenDashboard) merge into one unified KitchenDashboard. Router simplified accordingly.

**Tech Stack:** Vue 3 (Composition API), Tailwind CSS, Lucide Icons (replacing @heroicons/vue), SortableJS (retained for drag-drop)

**Spec:** `docs/superpowers/specs/2026-03-19-kitchen-display-redesign.md`

---

## File Structure

### Files to Modify

- `apps/kitchen-display/tailwind.config.js` — Replace kitchen-green/urgent-red with ios-\* tokens
- `apps/kitchen-display/src/App.vue` — Update root layout background to bg-ios-bg
- `apps/kitchen-display/src/router/index.ts` — Remove classic route + test-sse route, simplify
- `apps/kitchen-display/src/views/LoginView.vue` — Full template/style rewrite
- `apps/kitchen-display/src/views/SettingsView.vue` — Full template/style rewrite
- `apps/kitchen-display/src/views/HistoryView.vue` — Full template/style rewrite
- `apps/kitchen-display/src/views/NotFoundView.vue` — Full template/style rewrite
- `apps/kitchen-display/src/views/UnauthorizedView.vue` — Full template/style rewrite
- `apps/kitchen-display/src/views/EnhancedKitchenDashboard.vue` — Rename to KitchenDashboard, full rewrite
- `apps/kitchen-display/src/components/layout/KitchenHeader.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/orders/OrderCard.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/orders/OrderFilters.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/orders/OrderDetailsModal.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/orders/DragDropOrderBoard.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/orders/DraggableOrderCard.vue` — Update to use new OrderCard
- `apps/kitchen-display/src/components/orders/BatchOperations.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/stats/OrderStats.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/common/ConnectionStatus.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/shortcuts/KeyboardShortcutsHelp.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/offline/OfflineStatus.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/error/ErrorBoundary.vue` — Full template/style rewrite
- `apps/kitchen-display/src/components/audio/AudioSettings.vue` — Full template/style rewrite
- `apps/kitchen-display/package.json` — Add lucide-vue-next (heroicons removed in Task 16)

### Files to Delete

- `apps/kitchen-display/src/views/KitchenDashboard.vue` — Merged into new KitchenDashboard
- `apps/kitchen-display/src/views/TestSSEView.vue` — Dev-only test page, not in production spec
- `apps/kitchen-display/src/components/AudioSettings.vue` — Legacy duplicate

### Files to Create

- `apps/kitchen-display/src/components/orders/KanbanBoard.vue` — Wrapper around DragDropOrderBoard (named in spec Section 12 Core Components)

### Files NOT Modified (business logic stays unchanged)

- All files in `src/stores/` (auth, orders, orderManagement, settings)
- All files in `src/services/` (authApi, kitchenApi, sseService, etc.)
- All files in `src/composables/` (useRealtimeKitchen, useKitchenSSE, etc.)
- All files in `src/types/` (type definitions)
- All files in `src/utils/` (offline-storage, push-notifications)

---

## Task 1: Foundation — Tailwind Config + Dependencies

**Files:**

- Modify: `apps/kitchen-display/tailwind.config.js`
- Modify: `apps/kitchen-display/package.json`

- [ ] **Step 1: Install lucide-vue-next (keep @heroicons/vue temporarily)**

```bash
cd apps/kitchen-display
pnpm add lucide-vue-next
```

> **Note:** Do NOT remove @heroicons/vue yet — existing components still import it. It will be removed in Task 16 after all components are migrated.

- [ ] **Step 2: Rewrite tailwind.config.js with iOS design tokens**

Replace the existing kitchen-green/urgent-red color palettes and custom font sizes with the design system's ios-\* tokens. Keep existing content/plugins config.

```js
// Key changes to theme.extend:
colors: {
  'ios-bg': '#F2F2F7',
  'ios-card': '#FFFFFF',
  'ios-text': '#1C1C1E',
  'ios-secondary': '#8E8E93',
  'ios-tertiary': '#AEAEB2',
  'ios-separator': '#E5E5EA', // Available but most separators use border-ios-bg; this is for explicit divider lines
  'ios-blue': '#007AFF',
  'ios-green': '#34C759',
  'ios-orange': '#FF9500',
  'ios-red': '#FF3B30',
  'ios-teal': '#30B0C7',
},
boxShadow: {
  'card-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
  'card': '0 4px 16px rgba(0, 0, 0, 0.06)',
  'card-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',
},
borderRadius: {
  'ios': '20px',
  'ios-lg': '24px',
},
fontSize: {
  'kitchen-stats': ['2rem', { lineHeight: '1.2', fontWeight: '800' }],
  'kitchen-order': ['1.375rem', { lineHeight: '1.3', fontWeight: '800' }],
  'kitchen-table': ['1.125rem', { lineHeight: '1.3', fontWeight: '700' }],
},
keyframes: {
  'urgent-pulse': {
    '0%, 100%': { backgroundColor: '#FFF5F5' },
    '50%': { backgroundColor: '#FFEBEE' },
  },
},
animation: {
  'urgent-pulse': 'urgent-pulse 2s ease-in-out infinite',
},
transitionTimingFunction: {
  'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
},
```

- [ ] **Step 3: Verify build passes**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Audit and update App.vue root layout**

Read `apps/kitchen-display/src/App.vue`. Ensure the root element uses `bg-ios-bg min-h-screen`. Remove any old background colors or layout wrappers that conflict with the new design system.

- [ ] **Step 5: Commit**

```bash
git add apps/kitchen-display/tailwind.config.js apps/kitchen-display/package.json apps/kitchen-display/src/App.vue pnpm-lock.yaml
git commit -m "feat(kitchen): add iOS design tokens, install lucide-vue-next, update root layout"
```

---

## Task 2: Core Component — OrderCard

The most-used component. All other views depend on it.

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/OrderCard.vue`

**Reference:** Spec Section 4 (Order Card Component)

- [ ] **Step 1: Read current OrderCard.vue to understand all props and emits**

```bash
# Understand the component's API contract — props, emits, slots
```

- [ ] **Step 2: Rewrite OrderCard.vue template and styles**

Key design changes:

- Replace all heroicons imports with lucide-vue-next equivalents
- Card wrapper: `bg-white rounded-2xl shadow-card overflow-hidden`
- Top color border: 4px via `border-t-4` with dynamic status color
- Urgent state: `bg-[#FFF5F5] animate-urgent-pulse shadow-[0_4px_20px_rgba(255,59,48,0.08)]` + 6px border + URGENT corner badge
- Cancelled state: `opacity-45` + strikethrough order number
- Order number: `text-xl font-extrabold text-ios-text` (left)
- Table number: `text-lg font-bold text-ios-blue` (right)
- Order type badges: pill `rounded-full px-2.5 py-0.5 text-xs font-semibold` with pastel colors per spec Section 4.3
- Platform badges: same pill style with colors per spec Section 4.4
- Elapsed time: gray for normal, `text-ios-blue font-semibold` for preparing, `text-ios-red font-extrabold` for urgent
- Item list: `text-base font-medium text-ios-text`, separated by `border-ios-bg`
- Notes: `bg-[#FFF3E0] rounded-lg p-2` with ⚡ icon, only shown when notes exist
- Action button: `w-full rounded-full py-3 font-bold text-white` — blue for "開始製作", green for "✓ 標記完成", gray for "已出餐"
- All touch targets ≥ 44px

- [ ] **Step 3: Verify build passes**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/components/orders/OrderCard.vue
git commit -m "feat(kitchen): redesign OrderCard with iOS design system"
```

---

## Task 3: Core Component — OrderStats

**Files:**

- Modify: `apps/kitchen-display/src/components/stats/OrderStats.vue`

**Reference:** Spec Section 5.2 (Stats Panel)

- [ ] **Step 1: Read current OrderStats.vue**

- [ ] **Step 2: Rewrite template with pastel gradient panels**

Key design:

- 4-column grid: `grid grid-cols-4 gap-3`
- Each panel: `rounded-2xl p-3 text-center shadow-card-sm`
- Pending: `bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2]`, number `text-kitchen-stats text-[#E65100]` (note: `text-kitchen-stats` = 2rem/800 weight, equivalent to spec's `text-3xl font-extrabold`), label `text-xs font-semibold text-[#E65100]`
- Preparing: `bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB]`, number `text-[#0D47A1]`
- Ready: `bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9]`, number `text-[#1B5E20]`
- Urgent: `bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2]`, number `text-[#B71C1C]`
- Replace heroicons with lucide-vue-next

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/components/stats/OrderStats.vue
git commit -m "feat(kitchen): redesign OrderStats with pastel gradient panels"
```

---

## Task 4: Core Component — OrderFilters

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/OrderFilters.vue`

**Reference:** Spec Section 5.4 (Grid Mode filters)

- [ ] **Step 1: Read current OrderFilters.vue**

- [ ] **Step 2: Rewrite with pill filter design**

Key design:

- Horizontal scroll row: `flex gap-2 overflow-x-auto`
- Selected pill: `rounded-full px-3.5 py-1.5 text-sm font-semibold bg-ios-blue text-white`
- Unselected pills: pastel backgrounds per status color
  - 待處理: `bg-[#FFF3E0] text-ios-orange`
  - 製作中: `bg-[#E3F2FD] text-ios-blue`
  - 完成: `bg-[#E8F5E9] text-ios-green`
  - 緊急: `bg-[#FFEBEE] text-ios-red`
- Each pill shows count: e.g., "待處理 (5)"
- Replace heroicons with lucide-vue-next

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/components/orders/OrderFilters.vue
git commit -m "feat(kitchen): redesign OrderFilters with iOS pill style"
```

---

## Task 5: Core Component — KitchenHeader

**Files:**

- Modify: `apps/kitchen-display/src/components/layout/KitchenHeader.vue`

**Reference:** Spec Section 5.1 (Header)

- [ ] **Step 1: Read current KitchenHeader.vue**

- [ ] **Step 2: Rewrite with glassmorphism header**

Key design:

- Fixed top: `fixed top-0 w-full z-50`
- Glassmorphism: `bg-white/85 backdrop-blur-xl border-b border-black/5`
- Left: title `text-2xl font-extrabold text-ios-text` + ConnectionStatus green dot
- Center: iOS Segmented Control for Kanban/Grid — outer `bg-ios-bg rounded-full p-0.5`, active tab `bg-white rounded-full shadow-card-sm font-semibold`, inactive `text-ios-secondary`
- Right: circular buttons `w-11 h-11 rounded-full bg-ios-bg` for notification + settings
- Replace heroicons with lucide-vue-next (Bell, Settings icons)

- [ ] **Step 3: Commit**

```bash
git add apps/kitchen-display/src/components/layout/KitchenHeader.vue
git commit -m "feat(kitchen): redesign KitchenHeader with glassmorphism and segmented control"
```

---

## Task 6: Core Component — KanbanBoard + DragDropOrderBoard

**Files:**

- Create: `apps/kitchen-display/src/components/orders/KanbanBoard.vue` (wrapper, per spec Section 12)
- Modify: `apps/kitchen-display/src/components/orders/DragDropOrderBoard.vue`
- Modify: `apps/kitchen-display/src/components/orders/DraggableOrderCard.vue`

**Reference:** Spec Section 5.3 (Kanban Mode)

- [ ] **Step 1: Read both current files**

- [ ] **Step 2: Rewrite DragDropOrderBoard with tinted columns**

Key design:

- 3-column grid: `grid grid-cols-3 gap-3 h-full`
- Each column: `rounded-2xl p-3` with faint tinted background
  - Pending: `bg-[rgba(255,149,0,0.06)]`
  - Preparing: `bg-[rgba(0,122,255,0.04)]`
  - Ready: `bg-[rgba(52,199,89,0.04)]`
- Column header: `flex items-center justify-between mb-3`
  - Left: colored dot `w-2.5 h-2.5 rounded-full` + label `text-sm font-bold text-ios-text`
  - Right: count badge `min-w-6 h-6 rounded-full bg-{status-color} text-white text-xs font-bold flex items-center justify-center`
- Cards stacked with `space-y-2`
- SortableJS drag-drop config stays the same

- [ ] **Step 3: Create KanbanBoard.vue wrapper**

Create `apps/kitchen-display/src/components/orders/KanbanBoard.vue` as a thin wrapper around DragDropOrderBoard. This component exists as the named public API per spec Section 12 Core Components. It accepts the same props as DragDropOrderBoard (orders, loading) and simply renders DragDropOrderBoard inside a container with appropriate page-level padding and any Kanban-mode-specific layout logic.

- [ ] **Step 4: Update DraggableOrderCard to pass through to redesigned OrderCard**

Ensure it simply wraps OrderCard with drag handle if needed. Remove any old styling.

- [ ] **Step 5: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add apps/kitchen-display/src/components/orders/KanbanBoard.vue apps/kitchen-display/src/components/orders/DragDropOrderBoard.vue apps/kitchen-display/src/components/orders/DraggableOrderCard.vue
git commit -m "feat(kitchen): create KanbanBoard wrapper, redesign Kanban with tinted columns"
```

---

## Task 7: Core Component — OrderDetailsModal

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/OrderDetailsModal.vue`

**Reference:** Spec Section 9 (Order Details Modal)

- [ ] **Step 1: Read current OrderDetailsModal.vue**

- [ ] **Step 2: Rewrite as iOS Bottom Sheet**

Key design:

- Overlay: `fixed inset-0 bg-black/30 z-50` with fade transition
- Sheet: `fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl px-5 py-6` with slide-up transition (350ms ease-out)
- Drag handle: `w-10 h-1 rounded-full bg-gray-300 mx-auto mt-2.5`
- Header: order number `text-2xl font-extrabold` + type badge + close button `w-11 h-11 rounded-full bg-ios-bg`
- Subtext: table + time info, `text-sm text-ios-secondary`
- Items section: `bg-ios-bg rounded-2xl` inset list, each item shows name, customization (orange text), quantity, status badge
- Notes: `bg-[#FFF3E0] rounded-xl p-3 text-[#E65100]` with ⚡ icon
- Action: `w-full rounded-full py-4 font-bold text-white bg-ios-blue`
- Replace heroicons with lucide-vue-next (X icon for close)

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/components/orders/OrderDetailsModal.vue
git commit -m "feat(kitchen): redesign OrderDetailsModal as iOS Bottom Sheet"
```

---

## Task 8: Dashboard View — Unified KitchenDashboard

**Files:**

- Modify: `apps/kitchen-display/src/views/EnhancedKitchenDashboard.vue` (rename in git)
- Delete: `apps/kitchen-display/src/views/KitchenDashboard.vue`
- Modify: `apps/kitchen-display/src/router/index.ts`

**Reference:** Spec Section 5 (Dashboard Layout), Section 12 (Pages Map)

- [ ] **Step 1: Read current EnhancedKitchenDashboard.vue and KitchenDashboard.vue**

Understand all features that need to be preserved from both.

- [ ] **Step 2: Rewrite EnhancedKitchenDashboard.vue as the unified dashboard**

Key design:

- Page background: `bg-ios-bg min-h-screen`
- Content area: `pt-[header-height] px-5`
- Integrate: KitchenHeader (fixed top) → OrderStats (below header) → Kanban or Grid view (main content)
- Kanban/Grid toggle controlled by segmented control in header
- Kanban: render DragDropOrderBoard
- Grid: render OrderFilters + responsive grid (`grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3`)
- Audio notification hooks stay connected
- SSE/realtime connection stays connected
- Remove all old class names, replace with iOS design token classes

- [ ] **Step 3: Delete old KitchenDashboard.vue**

```bash
git rm apps/kitchen-display/src/views/KitchenDashboard.vue
```

- [ ] **Step 4: Update router — remove classic route, rename enhanced to standard**

In `router/index.ts`:

- Remove `/kitchen-classic/:restaurantId` route
- Remove `/test-sse` route (dev-only, not in production spec)
- Change EnhancedKitchenDashboard import to just KitchenDashboard (same file, renamed component)
- Keep `/kitchen/:restaurantId` as the primary route

- [ ] **Step 4.5: Delete TestSSEView.vue**

```bash
git rm apps/kitchen-display/src/views/TestSSEView.vue
```

- [ ] **Step 5: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add apps/kitchen-display/src/views/ apps/kitchen-display/src/router/index.ts
git commit -m "feat(kitchen): unify dashboard views, apply iOS design system layout"
```

---

## Task 9: LoginView

**Files:**

- Modify: `apps/kitchen-display/src/views/LoginView.vue`

**Reference:** Spec Section 6 (Login Page)

- [ ] **Step 1: Read current LoginView.vue**

- [ ] **Step 2: Rewrite with iOS centered login design**

Key design:

- Full page: `bg-ios-bg min-h-screen flex items-center justify-center`
- App icon: `w-20 h-20 rounded-[22px] bg-gradient-to-br from-ios-blue to-ios-green shadow-[0_8px_30px_rgba(0,122,255,0.08)]` centered, with kitchen Lucide icon (ChefHat or UtensilsCrossed)
- Title: `text-2xl font-extrabold text-ios-text` + subtitle `text-sm text-ios-secondary`
- Form card: `bg-white rounded-2xl p-6 shadow-card`
- Inputs: `bg-ios-bg rounded-xl py-3.5 px-4 text-base text-ios-text placeholder-ios-tertiary` — no borders
- Login button: `w-full bg-ios-blue text-white rounded-full py-4 font-bold text-base`
- Footer: `text-xs text-ios-secondary` — "僅限廚師角色登入"
- Error messages: `text-ios-red text-sm`
- Keep all auth logic (store calls, validation, error handling) unchanged

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/views/LoginView.vue
git commit -m "feat(kitchen): redesign LoginView with iOS centered card layout"
```

---

## Task 10: SettingsView

**Files:**

- Modify: `apps/kitchen-display/src/views/SettingsView.vue`

**Reference:** Spec Section 7 (Settings Page)

- [ ] **Step 1: Read current SettingsView.vue**

- [ ] **Step 2: Rewrite with iOS grouped inset list style**

Key design:

- Page: `bg-ios-bg min-h-screen`
- Back button: `w-11 h-11 rounded-full bg-white shadow-card-sm` + Lucide ArrowLeft
- Title: `text-2xl font-extrabold text-ios-text`
- Section labels: `text-xs font-semibold text-ios-secondary uppercase px-4 mb-1.5`
- Group card: `bg-white rounded-2xl shadow-card-sm overflow-hidden`
- List items: `flex items-center justify-between py-3.5 px-4`
- Separator: `border-b border-ios-bg ml-4` (left-indented)
- Toggle switch: `w-[44px] h-[26px] rounded-full` — green `bg-ios-green` when on, `bg-ios-bg` when off, white ball with shadow
- Segmented control: outer `bg-ios-bg rounded-full p-0.5`, active `bg-white rounded-full shadow-card-sm font-semibold`
- Slider: track `h-1 rounded-full bg-ios-bg`, filled `bg-ios-blue`, thumb `w-5 h-5 rounded-full bg-white shadow-card-sm`
- Disclosure: `text-ios-secondary` + `›` chevron
- Setting groups: 顯示 / 音效 / 時間門檻 per spec
- Keep all settings store bindings unchanged

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/views/SettingsView.vue
git commit -m "feat(kitchen): redesign SettingsView with iOS grouped list style"
```

---

## Task 11: HistoryView

**Files:**

- Modify: `apps/kitchen-display/src/views/HistoryView.vue`

**Reference:** Spec Section 8 (History Page)

- [ ] **Step 1: Read current HistoryView.vue**

- [ ] **Step 2: Rewrite with segmented control + summary + list**

Key design:

- Header: back button + title `text-2xl font-extrabold` + segmented control (今天/昨天/本週)
- Summary card: `bg-white rounded-2xl p-4 shadow-card`, 3-column grid — total orders, avg cooking time (green), on-time rate (blue)
- Order list: `bg-white rounded-2xl shadow-card overflow-hidden`
- Each row: order number `text-base font-extrabold` + status badge (pill) + type badge (pill) + details line (items summary, cooking time) + timestamp
- Cancelled rows: strikethrough + gray
- **Empty state**: centered Lucide Inbox icon (48px, `text-ios-tertiary`) + heading + body text
- Keep all data fetching logic unchanged

- [ ] **Step 3: Verify build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/views/HistoryView.vue
git commit -m "feat(kitchen): redesign HistoryView with summary stats and iOS list"
```

---

## Task 12: NotFoundView + UnauthorizedView

**Files:**

- Modify: `apps/kitchen-display/src/views/NotFoundView.vue`
- Modify: `apps/kitchen-display/src/views/UnauthorizedView.vue`

**Reference:** Spec Section 12 (Views)

- [ ] **Step 1: Read both current views**

- [ ] **Step 2: Rewrite NotFoundView**

Design:

- `bg-ios-bg min-h-screen flex items-center justify-center`
- Centered: Lucide SearchX icon `w-12 h-12 text-ios-tertiary` + "找不到頁面" `text-[22px] font-bold text-ios-text` + "請確認網址是否正確" `text-sm text-ios-secondary` + "返回廚房" pill button `bg-ios-blue text-white rounded-full px-6 py-3 font-bold`

- [ ] **Step 3: Rewrite UnauthorizedView**

Design:

- Same layout as NotFound but with Lucide ShieldX icon `w-12 h-12 text-ios-tertiary` + "無權限存取" `text-[22px] font-bold text-ios-text` + "此頁面僅限廚師角色使用" `text-sm text-ios-secondary` + "重新登入" pill button `bg-ios-blue text-white rounded-full px-6 py-3 font-bold`

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/views/NotFoundView.vue apps/kitchen-display/src/views/UnauthorizedView.vue
git commit -m "feat(kitchen): redesign NotFound and Unauthorized pages with iOS style"
```

---

## Task 13: Supporting Components — BatchOperations + KeyboardShortcutsHelp

**Files:**

- Modify: `apps/kitchen-display/src/components/orders/BatchOperations.vue`
- Modify: `apps/kitchen-display/src/components/shortcuts/KeyboardShortcutsHelp.vue`

**Reference:** Spec Section 12 (Supporting Components)

- [ ] **Step 1: Read both current components**

- [ ] **Step 2: Rewrite BatchOperations**

Design:

- Floating bottom bar: `fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl rounded-t-2xl shadow-card-lg px-5 py-3 z-40`
- Content: selected count badge `bg-ios-blue text-white rounded-full min-w-6 h-6` + "全部開始製作" (blue pill) + "全部標記完成" (green pill) + "取消選取" (gray text)
- Slide-up animation: 300ms ease-out
- Keep all batch action logic unchanged

- [ ] **Step 3: Rewrite KeyboardShortcutsHelp**

Design:

- Overlay: `fixed inset-0 bg-black/30 z-50 flex items-center justify-center`
- Modal: `bg-white rounded-2xl shadow-card-lg max-w-[480px] w-full mx-4 p-6`
- Title: `text-xl font-extrabold text-ios-text`
- Shortcut groups with section labels `text-xs font-semibold text-ios-secondary uppercase`
- Key badge: `bg-ios-bg rounded-lg px-2 py-1 font-mono text-sm`
- Keep all shortcut data/logic unchanged

- [ ] **Step 4: Commit**

```bash
git add apps/kitchen-display/src/components/orders/BatchOperations.vue apps/kitchen-display/src/components/shortcuts/KeyboardShortcutsHelp.vue
git commit -m "feat(kitchen): redesign BatchOperations and KeyboardShortcutsHelp"
```

---

## Task 14: Supporting Components — ConnectionStatus + OfflineStatus + ErrorBoundary

**Files:**

- Modify: `apps/kitchen-display/src/components/common/ConnectionStatus.vue`
- Modify: `apps/kitchen-display/src/components/offline/OfflineStatus.vue`
- Modify: `apps/kitchen-display/src/components/error/ErrorBoundary.vue`

- [ ] **Step 1: Read all three current components**

- [ ] **Step 2: Rewrite ConnectionStatus**

Design:

- Inline indicator: `flex items-center gap-1.5`
- Green dot: `w-2 h-2 rounded-full bg-ios-green` + "已連線" `text-xs font-semibold text-ios-green`
- Disconnected: `bg-ios-red` dot + "已斷線" `text-ios-red`
- Connecting: `bg-ios-orange animate-pulse` dot + "連線中..." `text-ios-orange`

- [ ] **Step 3: Rewrite OfflineStatus**

Design:

- Banner: `bg-ios-orange/10 rounded-2xl p-3 flex items-center gap-2`
- Lucide WifiOff icon `w-5 h-5 text-ios-orange` + "離線模式 — 資料可能不是最新" `text-sm text-ios-orange font-medium`

- [ ] **Step 4: Rewrite ErrorBoundary**

Design:

- Error card: `bg-white rounded-2xl shadow-card p-6 text-center`
- Lucide AlertTriangle icon `w-12 h-12 text-ios-red mx-auto`
- Title: `text-lg font-bold text-ios-text` + error message `text-sm text-ios-secondary`
- Retry button: `bg-ios-blue text-white rounded-full px-6 py-3 font-bold`

- [ ] **Step 5: Commit**

```bash
git add apps/kitchen-display/src/components/common/ConnectionStatus.vue apps/kitchen-display/src/components/offline/OfflineStatus.vue apps/kitchen-display/src/components/error/ErrorBoundary.vue
git commit -m "feat(kitchen): redesign ConnectionStatus, OfflineStatus, ErrorBoundary"
```

---

## Task 15: AudioSettings + Cleanup Legacy Duplicate

**Files:**

- Modify: `apps/kitchen-display/src/components/audio/AudioSettings.vue`
- Delete: `apps/kitchen-display/src/components/AudioSettings.vue` (legacy duplicate)

- [ ] **Step 1: Read current audio/AudioSettings.vue**

- [ ] **Step 2: Rewrite with iOS Settings list style**

Follow the same grouped inset list pattern used in SettingsView:

- Toggle switches for each sound type
- Volume slider with iOS styling
- Sound preview buttons as circular buttons `w-11 h-11 rounded-full bg-ios-bg`
- Keep all audio service bindings unchanged

- [ ] **Step 3: Delete legacy duplicate**

```bash
git rm apps/kitchen-display/src/components/AudioSettings.vue
```

- [ ] **Step 4: Verify build — ensure no imports reference the deleted file**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/kitchen-display/src/components/audio/AudioSettings.vue
git commit -m "feat(kitchen): redesign AudioSettings, remove legacy duplicate"
```

---

## Task 16: Final Integration — Remove Heroicons, TypeCheck, Build, Visual Verification

**Files:**

- Modify: `apps/kitchen-display/package.json` — remove @heroicons/vue
- Possibly fix: any remaining import errors

- [ ] **Step 0: Remove @heroicons/vue now that all components are migrated**

```bash
cd apps/kitchen-display && pnpm remove @heroicons/vue
```

- [ ] **Step 1: Run TypeScript check**

```bash
cd apps/kitchen-display && pnpm typecheck
```

Fix any type errors from the icon library migration.

- [ ] **Step 2: Run full build**

```bash
cd apps/kitchen-display && pnpm build
```

- [ ] **Step 3: Search for any remaining heroicons imports**

```bash
grep -r "@heroicons" apps/kitchen-display/src/
```

Replace any remaining references with lucide-vue-next equivalents.

- [ ] **Step 4: Search for any old color class usage (kitchen-green, urgent-red, etc.)**

```bash
grep -rn "kitchen-\|urgent-" apps/kitchen-display/src/ --include="*.vue" --include="*.ts"
```

Replace with ios-\* token equivalents.

- [ ] **Step 5: Run dev server and visually verify all pages**

```bash
cd apps/kitchen-display && pnpm dev
```

Walk through: Login → Dashboard (Kanban) → Dashboard (Grid) → Order Detail Modal → Settings → History → 404

- [ ] **Step 6: Run existing tests**

```bash
cd apps/kitchen-display && pnpm test
```

Fix any test failures caused by changed class names or removed elements.

- [ ] **Step 7: Final commit**

```bash
git add -A apps/kitchen-display/
git commit -m "feat(kitchen): complete iOS design system migration, fix remaining references"
```
