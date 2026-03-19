# Kitchen Display System — UI Redesign Spec

**Date:** 2026-03-19
**Approach:** Kitchen Pro (Apple-Native Soft Minimalism + Kitchen High-Contrast Adaptations)
**Scope:** Full redesign — all pages, components, interactions

---

## 1. Design Principles

- Strict adherence to Apple-Native Soft Minimalism design system (`docs/UIUX-design-system.md`)
- Kitchen-optimized: larger fonts (+2-4px vs standard), larger touch targets, bolder status colors
- Responsive: wall-mounted TV (≥1280px) + tablet horizontal (768-1279px) + tablet vertical (<768px)
- Dual view mode: Kanban (drag-drop 3-column) + Grid (card tiles) — user switchable via iOS segmented control

---

## 2. Color System (3+1)

Three status colors map to the order lifecycle, plus red for urgency alerts. All are standard iOS functional colors.

| Status    | Color  | Hex       | Card Treatment                                                       | Stats Panel                                |
| --------- | ------ | --------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Pending   | Orange | `#FF9500` | 4px top border                                                       | Gradient `#FFF3E0→#FFE0B2`, text `#E65100` |
| Preparing | Blue   | `#007AFF` | 4px top border                                                       | Gradient `#E3F2FD→#BBDEFB`, text `#0D47A1` |
| Ready     | Green  | `#34C759` | 4px top border                                                       | Gradient `#E8F5E9→#C8E6C9`, text `#1B5E20` |
| Urgent    | Red    | `#FF3B30` | 6px top border + `#FFF5F5` bg + red shadow (see note) + URGENT badge | Gradient `#FFEBEE→#FFCDD2`, text `#B71C1C` |

> **Kitchen override — Urgent card shadow:** Uses `0 4px 20px rgba(255,59,48,0.08)` (8% opacity colored red shadow). This stays within the design system's ≤8% opacity limit while providing a subtle red glow to distinguish urgent cards.

**Inactive states** (cancelled, delivered): system gray `#8E8E93` + `opacity: 0.45`. Not a semantic color.

**Base palette** (inherited from design system):

- Page background: `#F2F2F7` (ios-bg)
- Card background: `#FFFFFF` (ios-card)
- Primary text: `#1C1C1E` (ios-text) — never pure black
- Secondary text: `#8E8E93` (ios-secondary)
- Tertiary text: `#AEAEB2` (ios-tertiary)
- Separator: `#E5E5EA` (ios-separator)

---

## 3. Typography (Kitchen-Enlarged)

All sizes are +2-4px compared to the standard design system for kitchen readability.

| Role           | Weight        | Size | Tailwind                  | Color                     |
| -------------- | ------------- | ---- | ------------------------- | ------------------------- |
| Page title     | ExtraBold 800 | 28px | `text-2xl font-extrabold` | `text-ios-text`           |
| Order number   | ExtraBold 800 | 22px | `text-xl font-extrabold`  | `text-ios-text`           |
| Table number   | Bold 700      | 18px | `text-lg font-bold`       | `text-ios-blue`           |
| Item text      | Medium 500    | 16px | `text-base font-medium`   | `text-ios-text`           |
| Auxiliary text | Regular 400   | 14px | `text-sm`                 | `text-ios-secondary`      |
| Stats number   | ExtraBold 800 | 32px | `text-3xl font-extrabold` | Status color deep variant |

---

## 4. Order Card Component

### 4.1 Information Hierarchy (top to bottom)

1. **First glance (0.5s):** Order number (left, 22px bold) + Table number (right, 18px blue)
2. **Second glance (1s):** Order type badge (pill, pastel) + Platform badge (pill, pastel) + Elapsed time
3. **Details:** Item list with quantities, separated by `border-gray-100`
4. **Notes:** Orange highlight box `bg-[#FFF3E0]` with ⚡ icon (only if notes exist)
5. **Action:** Full-width pill button — "開始製作" (blue) or "✓ 標記完成" (green)

### 4.2 Card States

| State     | Top border    | Background | Shadow                            | Special                                     |
| --------- | ------------- | ---------- | --------------------------------- | ------------------------------------------- |
| Pending   | 4px `#FF9500` | white      | `card`                            | —                                           |
| Preparing | 4px `#007AFF` | white      | `card`                            | Blue elapsed time                           |
| Ready     | 4px `#34C759` | white      | `card`                            | Green "✓ 完成" text                         |
| Urgent    | 6px `#FF3B30` | `#FFF5F5`  | `0 4px 20px rgba(255,59,48,0.08)` | URGENT corner badge + pulse animation       |
| Cancelled | 4px `#8E8E93` | white      | `card`                            | `opacity: 0.45`, strikethrough order number |

### 4.3 Order Type Badges

| Type            | Background | Text Color |
| --------------- | ---------- | ---------- |
| 內用 (Dine-in)  | `#E3F2FD`  | `#007AFF`  |
| 外帶 (Takeaway) | `#FFF3E0`  | `#FF9500`  |
| 外送 (Delivery) | `#E8EAF6`  | `#283593`  |

### 4.4 Platform Badges

| Platform  | Background | Text Color |
| --------- | ---------- | ---------- |
| GrabFood  | `#E8F5E9`  | `#1B5E20`  |
| Foodpanda | `#FFEBEE`  | `#B71C1C`  |
| Uber Eats | `#E8F5E9`  | `#004D40`  |
| Direct    | `#F2F2F7`  | `#1C1C1E`  |

> **Badge differentiation:** Order type badges (內用/外帶/外送) use distinct color families. Platform badges share green palette for GrabFood and Uber Eats but use different text colors (`#1B5E20` vs `#004D40`) for distinction. When both a type badge and platform badge appear, they are visually distinguishable by their different background colors (e.g., Delivery = indigo `#E8EAF6` vs GrabFood = green `#E8F5E9`).

---

## 5. Dashboard Layout

### 5.1 Header (Fixed Top)

- Glassmorphism: `bg-white/85 backdrop-blur-xl border-b border-black/5`
- Left: Page title (28px ExtraBold) + Connection status (green dot + "已連線")
- Center: iOS Segmented Control — Kanban / Grid toggle
- Right: Circular icon buttons (notification, settings) — `w-11 h-11 rounded-full bg-ios-bg`

### 5.2 Stats Panel (Below Header)

- 4-column grid: Pending (orange gradient) | Preparing (blue gradient) | Ready (green gradient) | Urgent (red gradient)
- Each cell: large number (32px ExtraBold) + label (12px semibold, `text-xs font-semibold`)
- Pastel gradient backgrounds with deep text color for contrast
- Border radius: `rounded-2xl`

### 5.3 Kanban Mode

Three equal columns, each with a tinted background:

- Pending column: `rgba(255,149,0,0.06)` — very faint orange tint
- Preparing column: `rgba(0,122,255,0.04)` — very faint blue tint
- Ready column: `rgba(52,199,89,0.04)` — very faint green tint

Column header: colored dot + status label + count badge (filled circle with white number)

Cards are stacked vertically within each column. Drag-and-drop to move between columns (using SortableJS).

### 5.4 Grid Mode

- Filter pills row: "全部" (selected, blue fill) + status filters (pastel backgrounds)
- Cards in responsive grid: 4 columns (≥1280px) / 3 columns (768-1279px) / 2 columns (<768px)
- Cards sorted by: urgent first, then by elapsed time descending

### 5.5 Responsive Breakpoints

| Device             | Breakpoint | Kanban                       | Grid      |
| ------------------ | ---------- | ---------------------------- | --------- |
| TV / Large monitor | ≥1280px    | 3 columns equal width        | 4 columns |
| Tablet landscape   | 768-1279px | 3 columns (compressed cards) | 3 columns |
| Tablet portrait    | <768px     | Horizontal scroll 3 columns  | 2 columns |

---

## 6. Login Page

- Centered layout, vertically + horizontally
- App icon: 80×80px, `rounded-[22px]`, blue-to-green gradient, 🍳 emoji or kitchen icon
- Shadow: `0 8px 30px rgba(0,122,255,0.08)`
- Title: "廚房顯示系統" (28px ExtraBold) + "Kitchen Display System" (14px secondary)
- Form card: white, `rounded-2xl`, `shadow-card`
- Input fields: `bg-ios-bg rounded-xl` — no borders, padding `py-3.5 px-4`
- Login button: full-width, `bg-ios-blue text-white rounded-full py-4 font-bold`
- Footer note: "僅限廚師角色登入" (12px gray)

---

## 7. Settings Page

iOS Settings grouped inset list style:

- Back button: circular `w-11 h-11 rounded-full bg-white shadow-card-sm`
- Page title: 24px ExtraBold
- Groups with uppercase gray labels (12px, `text-ios-secondary`)
- List items inside white rounded card (`rounded-2xl shadow-card-sm`)
- Separators: `border-ios-bg` with left indent
- Controls:
  - Toggle: iOS-style switch (44×26px, green when on)
  - Segmented control: for font size (一般/大/特大)
  - Slider: for volume (track `h-1 rounded-full`, thumb 20px white circle with shadow)
  - Disclosure: right chevron `›` for sub-pages

**Setting groups:**

1. **顯示 (Display):** Font size, show customer names, show estimated time
2. **音效 (Audio):** Sound notifications toggle, volume slider, notification sound selection
3. **時間門檻 (Thresholds):** Urgent threshold (minutes), auto-refresh interval

---

## 8. History Page

- Back button + title "歷史紀錄" (24px ExtraBold)
- iOS Segmented Control: 今天 / 昨天 / 本週
- Summary card: white `rounded-2xl`, 3-column grid showing total orders, avg cooking time, on-time rate
- Order list: white `rounded-2xl`, each row shows:
  - Order number (16px bold) + status badge + type badge
  - Details line: table + items summary + cooking time (12px gray)
  - Timestamp (right-aligned, 12px gray)
- Cancelled orders: strikethrough number + gray badge + muted text
- **Empty state:** Centered illustration (Lucide `inbox` icon, 48px, `text-ios-tertiary`) + "尚無訂單紀錄" heading (16px semibold) + "選擇的時間範圍內沒有已完成的訂單" body (14px secondary)

---

## 9. Order Details Modal

iOS Bottom Sheet pattern:

- Slide up from bottom, `rounded-t-2xl`
- Drag handle: `w-10 h-1 rounded-full bg-gray-300` centered (per design system Section 7.8)
- Background overlay: `bg-black/30`
- Content:
  - Header: Order number (24px bold) + type badge + close button (circular)
  - Subtext: table + order time + elapsed time
  - Items section: `bg-ios-bg rounded-2xl` inset list, each item shows name, customization, quantity, status badge
  - Notes section: orange highlight box if notes exist
  - Action: full-width pill button

---

## 10. Animation Specifications

| Trigger                  | Animation                             | Duration | Easing                                              |
| ------------------------ | ------------------------------------- | -------- | --------------------------------------------------- |
| New order arrives        | Slide in from right + slight scale up | 300ms    | ease-out                                            |
| Status change (Kanban)   | Card slides to target column          | 250ms    | ease-out                                            |
| Status change (Grid)     | Border color transition               | 250ms    | ease-out                                            |
| Card tap                 | scale(0.97) → bounce back             | 150ms    | `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring approx) |
| Urgent order             | Background pulse (red tint breathing) | 2s       | infinite ease-in-out                                |
| Bottom Sheet open        | Slide up + overlay fade in            | 350ms    | ease-out                                            |
| Bottom Sheet close       | Slide down + overlay fade out         | 250ms    | ease-in                                             |
| Segmented control switch | Slider horizontal slide               | 200ms    | ease-out                                            |
| Toggle switch            | Ball slide + background color change  | 200ms    | `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring approx) |
| Order completed/removed  | Fade left + height collapse           | 300ms    | ease-in                                             |
| List items appear        | Fade up + stagger 50ms per item       | 200ms    | ease-out                                            |

---

## 11. Component Specifications

| Component         | Border Radius        | Shadow           | Padding         | Special                         |
| ----------------- | -------------------- | ---------------- | --------------- | ------------------------------- |
| Order Card        | `rounded-2xl`        | `card`           | `p-3` ~ `p-4`   | 4px top color border            |
| Stats Panel       | `rounded-2xl`        | `card-sm`        | `p-3`           | Pastel gradient bg              |
| Action Button     | `rounded-full`       | none             | `py-3 px-6`     | Pill shape, status-colored fill |
| Filter Pill       | `rounded-full`       | none             | `py-1.5 px-3.5` | Pastel bg / filled toggle       |
| Segmented Control | `rounded-full` shell | slider `card-sm` | `p-0.5`         | `bg-ios-bg` base                |
| Settings List     | `rounded-2xl` outer  | `card-sm`        | `py-3.5 px-4`   | iOS grouped inset style         |
| Bottom Sheet      | `rounded-t-2xl`      | `card-lg`        | `px-5 py-6`     | Drag handle + overlay           |
| Input Field       | `rounded-xl`         | none             | `py-3.5 px-4`   | `bg-ios-bg`, no border          |
| Circular Button   | `rounded-full`       | `card-sm`        | `w-11 h-11`     | Back, notification, settings    |
| Column (Kanban)   | `rounded-2xl`        | none             | `p-3`           | Very faint status-tinted bg     |

---

## 12. Pages & Components Map

### Views (6)

- **LoginView** — Chef authentication
- **KitchenDashboard** — Main dashboard (Kanban + Grid modes, replaces both EnhancedKitchenDashboard and classic KitchenDashboard)
- **SettingsView** — iOS grouped settings
- **HistoryView** — Order history with stats
- **NotFoundView** — 404: centered Lucide `search-x` icon (48px, ios-tertiary) + "找不到頁面" (22px bold) + "請確認網址是否正確" (14px secondary) + "返回廚房" pill button (ios-blue)
- **UnauthorizedView** — 403: centered Lucide `shield-x` icon (48px, ios-tertiary) + "無權限存取" (22px bold) + "此頁面僅限廚師角色使用" (14px secondary) + "重新登入" pill button (ios-blue)

### Core Components (6)

- **KitchenHeader** — Glassmorphism top bar with segmented control
- **OrderCard** — Order display with status color system
- **OrderStats** — 4-panel pastel gradient statistics
- **OrderFilters** — Pill filter row for Grid mode
- **KanbanBoard** — 3-column drag-drop board (wraps DragDropOrderBoard)
- **OrderDetailsModal** — iOS Bottom Sheet

### Supporting Components (6)

- **ConnectionStatus** — Green/red dot indicator
- **AudioSettings** — Sound configuration (within Settings)
- **BatchOperations** — Multi-select action bar. Activated by long-press on any card or "批量操作" button in header. Shows floating bottom bar (`bg-white/90 backdrop-blur-xl rounded-t-2xl shadow-card-lg`, fixed bottom, px-5 py-3) with: selected count badge + "全部開始製作" (blue pill) + "全部標記完成" (green pill) + "取消選取" (gray text button). Selected cards show a blue checkmark overlay. Dismiss by tapping "取消選取" or pressing Escape.
- **KeyboardShortcutsHelp** — Shortcut overlay. Triggered by pressing `?` key or via settings. Displays a centered modal (`rounded-2xl shadow-card-lg`, max-width 480px) with grouped shortcut list: **Orders** (1-9: select order, Enter: open detail, S: start cooking, D: mark done) · **Navigation** (Tab: cycle columns, K/G: switch Kanban/Grid) · **System** (R: refresh, ?: help, Esc: close). Each shortcut shows key badge (`bg-ios-bg rounded-lg px-2 py-1 font-mono`) + description.
- **OfflineStatus** — Offline banner
- **ErrorBoundary** — Graceful error display

---

## 13. Icon System

- **Library:** Lucide Icons (SF Symbols style for web)
- **Style:** Outline by default, filled when selected/active
- **Sizes:** Navigation 24px, content 18px, decorative 14px
- **Color:** Follows parent text color rules

---

## 14. Tailwind Config Extensions

```js
// Added to existing tailwind.config.js
{
  theme: {
    extend: {
      // Kitchen-specific font sizes (larger than standard)
      fontSize: {
        'kitchen-stats': ['2rem', { lineHeight: '1.2', fontWeight: '800' }],
        'kitchen-order': ['1.375rem', { lineHeight: '1.3', fontWeight: '800' }],
        'kitchen-table': ['1.125rem', { lineHeight: '1.3', fontWeight: '700' }],
      },
      // Urgent card animation
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
    }
  }
}
```

---

## 15. Design Checklist

Before implementing any component, verify:

- [ ] Page background is `#F2F2F7`
- [ ] Cards are white + `rounded-2xl` + soft shadow (opacity ≤ 8%)
- [ ] No hard 1px solid borders — separation via shadow + bg difference
- [ ] Buttons and badges use `rounded-full` (pill shape)
- [ ] Shadows are soft enough (opacity ≤ 8%)
- [ ] Text avoids pure black (use `#1C1C1E`)
- [ ] Strong hierarchy contrast between title and body
- [ ] Adequate whitespace and breathing room
- [ ] Only 3+1 semantic colors used (orange/blue/green + red urgent)
- [ ] Pastel backgrounds maintain low saturation, high brightness
- [ ] Icons follow SF Symbols / Lucide outline style
- [ ] Animations are 200-350ms, ease-out, iOS-native feel
- [ ] Touch targets are ≥44px for kitchen glove usage
- [ ] Overall feel resembles a native iOS app
