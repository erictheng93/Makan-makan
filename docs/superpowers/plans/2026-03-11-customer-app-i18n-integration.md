# Customer-App i18n Integration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate customer-app with the shared i18n package and eliminate all hardcoded Chinese strings (~270 strings across 20 files).

**Architecture:** Migrate customer-app from its standalone i18n system to the shared `@makanmakan/i18n` package. All translations move to `packages/shared/src/i18n/src/locales/` with static imports. Customer-app's `useI18n` composable API is preserved.

**Tech Stack:** vue-i18n 9, TypeScript, pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-03-11-customer-app-i18n-integration-design.md`

---

## Chunk 1: Shared Package Infrastructure

### Task 1: Update shared i18n types — add vi-VN, expand CustomerAppMessages

**Files:**

- Modify: `packages/shared/src/i18n/src/types.ts`

- [ ] **Step 1: Update SupportedLocale type and SUPPORTED_LOCALES array**

In `packages/shared/src/i18n/src/types.ts`:

Change the type on line 6:

```typescript
export type SupportedLocale =
  | "en-US"
  | "zh-TW"
  | "zh-CN"
  | "ms-MY"
  | "id-ID"
  | "vi-VN";
```

Add vi-VN entry to `SUPPORTED_LOCALES` array (after id-ID entry, before the closing `]`):

```typescript
  {
    code: "vi-VN",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    flag: "🇻🇳",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    currencyCode: "VND",
    currencySymbol: "₫",
  },
```

- [ ] **Step 2: Update CustomerAppMessages type**

Replace the existing `CustomerAppMessages` type alias (line 172) with a proper interface that reflects the actual customer-app translation structure:

```typescript
export interface CustomerAppMessages extends BaseMessageSchema {
  navigation: Record<string, string>;
  home: Record<string, any>;
  qrScan: Record<string, string>;
  menu: Record<string, string>;
  menuItem: Record<string, string>;
  customization: Record<string, string>;
  cart: Record<string, any>;
  order: Record<string, any>;
  service: Record<string, any>;
  payment: Record<string, any>;
  profile: Record<string, string>;
  restaurant: Record<string, string>;
  about: Record<string, any>;
  privacy: Record<string, any>;
  terms: Record<string, any>;
  errors: Record<string, string>;
  time: Record<string, string>;
  auth: Record<string, any>;
  toast: Record<string, string>;
  orderTracking: Record<string, any>;
  orderHistory: Record<string, any>;
  shopCart: Record<string, any>;
  errorBoundary: Record<string, string>;
  manualInput: Record<string, string>;
  qrScanView: Record<string, string>;
  shopMenu: Record<string, string>;
  phoneVerification: Record<string, any>;
  menuItemCard: Record<string, string>;
  menuItemModal: Record<string, any>;
  orderItem: Record<string, string>;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd packages/shared/src/i18n && pnpm typecheck`
Expected: PASS (or pre-existing errors only)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/i18n/src/types.ts
git commit -m "feat(i18n): add vi-VN locale and expand CustomerAppMessages type"
```

---

### Task 2: Fix LocaleManager issues in shared i18n index.ts

**Files:**

- Modify: `packages/shared/src/i18n/src/index.ts`

- [ ] **Step 1: Fix isValidLocale to use SUPPORTED_LOCALES instead of hardcoded array**

Replace the `isValidLocale` method (lines 103-111):

```typescript
  static isValidLocale(locale: string): boolean {
    return SUPPORTED_LOCALES.some((l) => l.code === locale);
  }
```

- [ ] **Step 2: Add Vietnamese case to browser language detection**

In the `getStoredLocale()` method, add a `vi` case in the switch statement (after the `id` case, before `en`):

```typescript
          case "vi":
            return "vi-VN";
```

- [ ] **Step 3: Fix require() to ESM imports**

Replace the `getLocaleInfo` and `getAvailableLocales` methods that use `require()`:

```typescript
  static getLocaleInfo(locale: SupportedLocale): LocaleInfo {
    return (
      SUPPORTED_LOCALES.find((l) => l.code === locale) ||
      SUPPORTED_LOCALES[0]
    );
  }

  static getAvailableLocales(): LocaleInfo[] {
    return SUPPORTED_LOCALES;
  }
```

Also add the import at the top of the file (it's already exported via `export { SUPPORTED_LOCALES } from "./types"` but not imported for local use):

```typescript
import { SUPPORTED_LOCALES } from "./types";
```

Remove the existing `export { SUPPORTED_LOCALES } from "./types"` line since it's already covered by `export * from "./types"`.

- [ ] **Step 4: Verify typecheck**

Run: `cd packages/shared/src/i18n && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/i18n/src/index.ts
git commit -m "fix(i18n): fix LocaleManager isValidLocale, browser detection, and ESM imports"
```

---

### Task 3: Update tsconfig and package.json

**Files:**

- Modify: `packages/shared/src/i18n/tsconfig.json`
- Modify: `packages/shared/src/i18n/package.json`

- [ ] **Step 1: Add resolveJsonModule to tsconfig.json**

Add `"resolveJsonModule": true` to the `compilerOptions` in `packages/shared/src/i18n/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Add static-messages export to package.json**

Update the `exports` field in `packages/shared/src/i18n/package.json`:

```json
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./static-messages": {
      "import": "./dist/static-messages.js",
      "types": "./dist/static-messages.d.ts"
    },
    "./locales/*": "./src/locales/*"
  },
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/i18n/tsconfig.json packages/shared/src/i18n/package.json
git commit -m "chore(i18n): add resolveJsonModule and static-messages export"
```

---

## Chunk 2: Locale Files — Common

### Task 4: Create/update common.json for all 6 locales

The shared package's `common.json` needs keys that are reusable across all apps. We expand the existing en-US and zh-TW files and create new ones for zh-CN, vi-VN, ms-MY, id-ID.

**Files:**

- Modify: `packages/shared/src/i18n/src/locales/en-US/common.json`
- Modify: `packages/shared/src/i18n/src/locales/zh-TW/common.json`
- Create: `packages/shared/src/i18n/src/locales/zh-CN/common.json`
- Create: `packages/shared/src/i18n/src/locales/vi-VN/common.json`
- Create: `packages/shared/src/i18n/src/locales/ms-MY/common.json`
- Create: `packages/shared/src/i18n/src/locales/id-ID/common.json`

- [ ] **Step 1: Update en-US/common.json**

Add new keys to the existing `common`, `validation`, and `messages` sections. Write the complete file:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "view": "View",
    "create": "Create",
    "update": "Update",
    "search": "Search",
    "confirm": "Confirm",
    "close": "Close",
    "loading": "Loading...",
    "success": "Success",
    "error": "Error",
    "warning": "Warning",
    "info": "Information",
    "yes": "Yes",
    "no": "No",
    "active": "Active",
    "inactive": "Inactive",
    "next": "Next",
    "previous": "Previous",
    "finish": "Finish",
    "back": "Back",
    "total": "Total",
    "count": "Count",
    "name": "Name",
    "description": "Description",
    "status": "Status",
    "date": "Date",
    "time": "Time",
    "retry": "Retry",
    "home": "Home",
    "menu": "Menu",
    "cart": "Cart",
    "order": "Order",
    "subtotal": "Subtotal",
    "quantity": "Quantity",
    "price": "Price",
    "filter": "Filter",
    "sort": "Sort",
    "clear": "Clear",
    "apply": "Apply",
    "reset": "Reset",
    "off": "off",
    "loadingApp": "Loading..."
  },
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email address",
    "password": "Password must be at least 8 characters",
    "passwordConfirm": "Passwords do not match",
    "minLength": "Minimum {min} characters required",
    "maxLength": "Maximum {max} characters allowed",
    "invalidFormat": "Invalid format",
    "phone": "Please enter a valid phone number",
    "numeric": "Please enter numbers only",
    "positiveNumber": "Please enter a positive number"
  },
  "messages": {
    "saveSuccess": "Saved successfully",
    "saveError": "Save failed",
    "deleteConfirm": "Are you sure you want to delete this item?",
    "deleteSuccess": "Deleted successfully",
    "deleteError": "Delete failed",
    "loadError": "Failed to load data",
    "networkError": "Network error. Please check your connection.",
    "permissionDenied": "Permission denied",
    "sessionExpired": "Session expired. Please login again."
  },
  "time": {
    "now": "Now",
    "minutes": "minutes",
    "hours": "hours",
    "days": "days",
    "ago": "ago",
    "later": "later",
    "estimated": "estimated",
    "actual": "actual"
  }
}
```

- [ ] **Step 2: Update zh-TW/common.json**

```json
{
  "common": {
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除",
    "edit": "編輯",
    "view": "檢視",
    "create": "建立",
    "update": "更新",
    "search": "搜尋",
    "confirm": "確認",
    "close": "關閉",
    "loading": "載入中...",
    "success": "成功",
    "error": "錯誤",
    "warning": "警告",
    "info": "資訊",
    "yes": "是",
    "no": "否",
    "active": "啟用",
    "inactive": "停用",
    "next": "下一步",
    "previous": "上一步",
    "finish": "完成",
    "back": "返回",
    "total": "總計",
    "count": "數量",
    "name": "名稱",
    "description": "說明",
    "status": "狀態",
    "date": "日期",
    "time": "時間",
    "retry": "重試",
    "home": "首頁",
    "menu": "菜單",
    "cart": "購物車",
    "order": "訂單",
    "subtotal": "小計",
    "quantity": "數量",
    "price": "價格",
    "filter": "篩選",
    "sort": "排序",
    "clear": "清除",
    "apply": "套用",
    "reset": "重設",
    "off": "折扣",
    "loadingApp": "載入中..."
  },
  "validation": {
    "required": "此欄位為必填",
    "email": "請輸入有效的電子郵件地址",
    "password": "密碼至少需要8個字元",
    "passwordConfirm": "密碼不一致",
    "minLength": "至少需要 {min} 個字元",
    "maxLength": "最多允許 {max} 個字元",
    "invalidFormat": "格式錯誤",
    "phone": "請輸入有效的電話號碼",
    "numeric": "請輸入數字",
    "positiveNumber": "請輸入正數"
  },
  "messages": {
    "saveSuccess": "儲存成功",
    "saveError": "儲存失敗",
    "deleteConfirm": "確定要刪除此項目嗎？",
    "deleteSuccess": "刪除成功",
    "deleteError": "刪除失敗",
    "loadError": "載入資料失敗",
    "networkError": "網路錯誤，請檢查您的網路連線",
    "permissionDenied": "權限不足",
    "sessionExpired": "登入已過期，請重新登入"
  },
  "time": {
    "now": "現在",
    "minutes": "分鐘",
    "hours": "小時",
    "days": "天",
    "ago": "前",
    "later": "後",
    "estimated": "預估",
    "actual": "實際"
  }
}
```

- [ ] **Step 3: Create zh-CN/common.json**

Create directory first: `mkdir -p packages/shared/src/i18n/src/locales/zh-CN`

```json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "edit": "编辑",
    "view": "查看",
    "create": "创建",
    "update": "更新",
    "search": "搜索",
    "confirm": "确认",
    "close": "关闭",
    "loading": "加载中...",
    "success": "成功",
    "error": "错误",
    "warning": "警告",
    "info": "信息",
    "yes": "是",
    "no": "否",
    "active": "启用",
    "inactive": "停用",
    "next": "下一步",
    "previous": "上一步",
    "finish": "完成",
    "back": "返回",
    "total": "总计",
    "count": "数量",
    "name": "名称",
    "description": "说明",
    "status": "状态",
    "date": "日期",
    "time": "时间",
    "retry": "重试",
    "home": "首页",
    "menu": "菜单",
    "cart": "购物车",
    "order": "订单",
    "subtotal": "小计",
    "quantity": "数量",
    "price": "价格",
    "filter": "筛选",
    "sort": "排序",
    "clear": "清除",
    "apply": "应用",
    "reset": "重置",
    "off": "折扣",
    "loadingApp": "加载中..."
  },
  "validation": {
    "required": "此字段为必填",
    "email": "请输入有效的电子邮件地址",
    "password": "密码至少需要8个字符",
    "passwordConfirm": "密码不一致",
    "minLength": "至少需要 {min} 个字符",
    "maxLength": "最多允许 {max} 个字符",
    "invalidFormat": "格式错误",
    "phone": "请输入有效的电话号码",
    "numeric": "请输入数字",
    "positiveNumber": "请输入正数"
  },
  "messages": {
    "saveSuccess": "保存成功",
    "saveError": "保存失败",
    "deleteConfirm": "确定要删除此项目吗？",
    "deleteSuccess": "删除成功",
    "deleteError": "删除失败",
    "loadError": "加载数据失败",
    "networkError": "网络错误，请检查您的网络连接",
    "permissionDenied": "权限不足",
    "sessionExpired": "登录已过期，请重新登录"
  },
  "time": {
    "now": "现在",
    "minutes": "分钟",
    "hours": "小时",
    "days": "天",
    "ago": "前",
    "later": "后",
    "estimated": "预估",
    "actual": "实际"
  }
}
```

- [ ] **Step 4: Create vi-VN/common.json**

Create directory: `mkdir -p packages/shared/src/i18n/src/locales/vi-VN`

```json
{
  "common": {
    "save": "Lưu",
    "cancel": "Hủy",
    "delete": "Xóa",
    "edit": "Chỉnh sửa",
    "view": "Xem",
    "create": "Tạo",
    "update": "Cập nhật",
    "search": "Tìm kiếm",
    "confirm": "Xác nhận",
    "close": "Đóng",
    "loading": "Đang tải...",
    "success": "Thành công",
    "error": "Lỗi",
    "warning": "Cảnh báo",
    "info": "Thông tin",
    "yes": "Có",
    "no": "Không",
    "active": "Hoạt động",
    "inactive": "Không hoạt động",
    "next": "Tiếp theo",
    "previous": "Trước đó",
    "finish": "Hoàn thành",
    "back": "Quay lại",
    "total": "Tổng cộng",
    "count": "Số lượng",
    "name": "Tên",
    "description": "Mô tả",
    "status": "Trạng thái",
    "date": "Ngày",
    "time": "Thời gian",
    "retry": "Thử lại",
    "home": "Trang chủ",
    "menu": "Thực đơn",
    "cart": "Giỏ hàng",
    "order": "Đơn hàng",
    "subtotal": "Tạm tính",
    "quantity": "Số lượng",
    "price": "Giá",
    "filter": "Lọc",
    "sort": "Sắp xếp",
    "clear": "Xóa",
    "apply": "Áp dụng",
    "reset": "Đặt lại",
    "off": "Giảm giá",
    "loadingApp": "Đang tải..."
  },
  "validation": {
    "required": "Trường này là bắt buộc",
    "email": "Vui lòng nhập email hợp lệ",
    "password": "Mật khẩu phải có ít nhất 8 ký tự",
    "passwordConfirm": "Mật khẩu không khớp",
    "minLength": "Ít nhất {min} ký tự là bắt buộc",
    "maxLength": "Không thể vượt quá {max} ký tự",
    "invalidFormat": "Định dạng không hợp lệ",
    "phone": "Vui lòng nhập số điện thoại hợp lệ",
    "numeric": "Vui lòng chỉ nhập số",
    "positiveNumber": "Vui lòng nhập số dương"
  },
  "messages": {
    "saveSuccess": "Lưu thành công",
    "saveError": "Lưu thất bại",
    "deleteConfirm": "Bạn có chắc chắn muốn xóa mục này?",
    "deleteSuccess": "Xóa thành công",
    "deleteError": "Xóa thất bại",
    "loadError": "Tải dữ liệu thất bại",
    "networkError": "Lỗi mạng. Vui lòng kiểm tra kết nối.",
    "permissionDenied": "Không có quyền truy cập",
    "sessionExpired": "Phiên đã hết hạn. Vui lòng đăng nhập lại."
  },
  "time": {
    "now": "Bây giờ",
    "minutes": "phút",
    "hours": "giờ",
    "days": "ngày",
    "ago": "trước",
    "later": "sau",
    "estimated": "dự kiến",
    "actual": "thực tế"
  }
}
```

- [ ] **Step 5: Create ms-MY/common.json**

Create directory: `mkdir -p packages/shared/src/i18n/src/locales/ms-MY`

```json
{
  "common": {
    "save": "Simpan",
    "cancel": "Batal",
    "delete": "Padam",
    "edit": "Sunting",
    "view": "Lihat",
    "create": "Cipta",
    "update": "Kemas kini",
    "search": "Cari",
    "confirm": "Sahkan",
    "close": "Tutup",
    "loading": "Memuatkan...",
    "success": "Berjaya",
    "error": "Ralat",
    "warning": "Amaran",
    "info": "Maklumat",
    "yes": "Ya",
    "no": "Tidak",
    "active": "Aktif",
    "inactive": "Tidak aktif",
    "next": "Seterusnya",
    "previous": "Sebelumnya",
    "finish": "Selesai",
    "back": "Kembali",
    "total": "Jumlah",
    "count": "Bilangan",
    "name": "Nama",
    "description": "Penerangan",
    "status": "Status",
    "date": "Tarikh",
    "time": "Masa",
    "retry": "Cuba semula",
    "home": "Utama",
    "menu": "Menu",
    "cart": "Troli",
    "order": "Pesanan",
    "subtotal": "Subjumlah",
    "quantity": "Kuantiti",
    "price": "Harga",
    "filter": "Tapis",
    "sort": "Isih",
    "clear": "Kosongkan",
    "apply": "Guna",
    "reset": "Set semula",
    "off": "Diskaun",
    "loadingApp": "Memuatkan..."
  },
  "validation": {
    "required": "Medan ini diperlukan",
    "email": "Sila masukkan e-mel yang sah",
    "password": "Kata laluan mesti sekurang-kurangnya 8 aksara",
    "passwordConfirm": "Kata laluan tidak sepadan",
    "minLength": "Minimum {min} aksara diperlukan",
    "maxLength": "Maksimum {max} aksara dibenarkan",
    "invalidFormat": "Format tidak sah",
    "phone": "Sila masukkan nombor telefon yang sah",
    "numeric": "Sila masukkan nombor sahaja",
    "positiveNumber": "Sila masukkan nombor positif"
  },
  "messages": {
    "saveSuccess": "Berjaya disimpan",
    "saveError": "Gagal menyimpan",
    "deleteConfirm": "Adakah anda pasti mahu memadam item ini?",
    "deleteSuccess": "Berjaya dipadam",
    "deleteError": "Gagal memadam",
    "loadError": "Gagal memuatkan data",
    "networkError": "Ralat rangkaian. Sila semak sambungan anda.",
    "permissionDenied": "Akses ditolak",
    "sessionExpired": "Sesi tamat. Sila log masuk semula."
  },
  "time": {
    "now": "Sekarang",
    "minutes": "minit",
    "hours": "jam",
    "days": "hari",
    "ago": "lalu",
    "later": "kemudian",
    "estimated": "anggaran",
    "actual": "sebenar"
  }
}
```

- [ ] **Step 6: Create id-ID/common.json**

Create directory: `mkdir -p packages/shared/src/i18n/src/locales/id-ID`

```json
{
  "common": {
    "save": "Simpan",
    "cancel": "Batal",
    "delete": "Hapus",
    "edit": "Edit",
    "view": "Lihat",
    "create": "Buat",
    "update": "Perbarui",
    "search": "Cari",
    "confirm": "Konfirmasi",
    "close": "Tutup",
    "loading": "Memuat...",
    "success": "Berhasil",
    "error": "Kesalahan",
    "warning": "Peringatan",
    "info": "Informasi",
    "yes": "Ya",
    "no": "Tidak",
    "active": "Aktif",
    "inactive": "Tidak aktif",
    "next": "Selanjutnya",
    "previous": "Sebelumnya",
    "finish": "Selesai",
    "back": "Kembali",
    "total": "Total",
    "count": "Jumlah",
    "name": "Nama",
    "description": "Deskripsi",
    "status": "Status",
    "date": "Tanggal",
    "time": "Waktu",
    "retry": "Coba lagi",
    "home": "Beranda",
    "menu": "Menu",
    "cart": "Keranjang",
    "order": "Pesanan",
    "subtotal": "Subtotal",
    "quantity": "Jumlah",
    "price": "Harga",
    "filter": "Filter",
    "sort": "Urutkan",
    "clear": "Hapus",
    "apply": "Terapkan",
    "reset": "Atur ulang",
    "off": "Diskon",
    "loadingApp": "Memuat..."
  },
  "validation": {
    "required": "Kolom ini wajib diisi",
    "email": "Silakan masukkan email yang valid",
    "password": "Kata sandi harus minimal 8 karakter",
    "passwordConfirm": "Kata sandi tidak cocok",
    "minLength": "Minimal {min} karakter diperlukan",
    "maxLength": "Maksimal {max} karakter diperbolehkan",
    "invalidFormat": "Format tidak valid",
    "phone": "Silakan masukkan nomor telepon yang valid",
    "numeric": "Silakan masukkan angka saja",
    "positiveNumber": "Silakan masukkan angka positif"
  },
  "messages": {
    "saveSuccess": "Berhasil disimpan",
    "saveError": "Gagal menyimpan",
    "deleteConfirm": "Apakah Anda yakin ingin menghapus item ini?",
    "deleteSuccess": "Berhasil dihapus",
    "deleteError": "Gagal menghapus",
    "loadError": "Gagal memuat data",
    "networkError": "Kesalahan jaringan. Silakan periksa koneksi Anda.",
    "permissionDenied": "Akses ditolak",
    "sessionExpired": "Sesi berakhir. Silakan masuk kembali."
  },
  "time": {
    "now": "Sekarang",
    "minutes": "menit",
    "hours": "jam",
    "days": "hari",
    "ago": "lalu",
    "later": "kemudian",
    "estimated": "perkiraan",
    "actual": "aktual"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/i18n/src/locales/
git commit -m "feat(i18n): create/update common.json for all 6 locales"
```

---

## Chunk 3: Customer Locale Files

### Task 5: Create zh-TW/customer.json (reference locale)

This is the primary locale. All customer-app specific keys go here. This migrates the 334 existing keys from `apps/customer-app/src/i18n/locales/zh-TW.json` (minus the ones moved to common.json) and adds ~100 new keys for hardcoded strings.

**Files:**

- Create: `packages/shared/src/i18n/src/locales/zh-TW/customer.json`

- [ ] **Step 1: Create zh-TW/customer.json**

This file contains ALL customer-app specific translations. It includes:

- Migrated keys from the old zh-TW.json (navigation, home, qrScan, menu, menuItem, customization, cart, order, service, payment, profile, errors, restaurant, about, privacy, terms)
- New sections: auth, toast, orderTracking, orderHistory, shopCart, errorBoundary, manualInput, qrScanView, shopMenu, phoneVerification, menuItemCard, menuItemModal, orderItem

Write the complete file. The full content is the existing `apps/customer-app/src/i18n/locales/zh-TW.json` content (excluding `common`, `validation`, `time` which moved to common.json) PLUS these new sections:

```json
{
  "navigation": { ... },
  "home": { ... },
  "qrScan": { ... },
  "menu": { ... },
  "menuItem": { ... },
  "customization": { ... },
  "cart": {
    ... existing keys ...,
    "minimumOrderShortfall": "還需加點 ${amount} 才能下單",
    "minimumOrderMet": "已達到最低消費標準 ✓",
    "minimumOrderNote": "最低消費：${amount}",
    "couponSaving": "優惠券已套用！節省 ${amount}",
    "confirmOrderMessage": "您即將提交總額 ${amount} 的訂單，確定要繼續嗎？"
  },
  "order": { ... },
  "service": { ... },
  "payment": { ... },
  "profile": { ... },
  "errors": { ... },
  "restaurant": { ... },
  "about": { ... },
  "privacy": { ... },
  "terms": { ... },
  "auth": {
    "login": "登入",
    "register": "註冊",
    "memberLogin": "會員登入",
    "memberRegister": "會員註冊",
    "username": "帳號",
    "password": "密碼",
    "displayName": "姓名",
    "email": "Email",
    "phone": "手機號碼",
    "usernamePlaceholder": "請輸入帳號",
    "passwordPlaceholder": "請輸入密碼",
    "passwordPlaceholderWithMin": "請輸入密碼（至少6個字符）",
    "displayNamePlaceholder": "請輸入姓名",
    "emailPlaceholder": "請輸入Email（選填）",
    "phonePlaceholder": "請輸入手機號碼（選填）",
    "confirmPassword": "確認密碼",
    "confirmPasswordPlaceholder": "請再次輸入密碼",
    "forgotPassword": "忘記密碼？",
    "noAccount": "還沒有帳號？",
    "hasAccount": "已經有帳號？",
    "registerNow": "立即註冊",
    "loginNow": "立即登入",
    "guestBrowse": "以訪客身分繼續瀏覽",
    "loggingIn": "登入中...",
    "registering": "註冊中...",
    "loginFailed": "登入失敗",
    "loginError": "登入過程中發生錯誤",
    "registerFailed": "註冊失敗",
    "registerError": "註冊過程中發生錯誤",
    "usernameRequired": "請輸入帳號",
    "usernameMinLength": "帳號至少需要3個字符",
    "passwordRequired": "請輸入密碼",
    "passwordMinLength": "密碼至少需要6個字符",
    "displayNameRequired": "請輸入姓名",
    "confirmPasswordRequired": "請再次輸入密碼",
    "passwordMismatch": "兩次輸入的密碼不一致",
    "invalidEmail": "請輸入有效的Email格式",
    "invalidPhone": "請輸入有效的手機號碼",
    "forgotPasswordTitle": "忘記密碼",
    "forgotPasswordDesc": "輸入您的 Email 地址，我們將發送重設密碼的連結給您",
    "emailAddress": "Email 地址",
    "emailPlaceholderForgot": "your@email.com",
    "sendResetLink": "發送重設連結",
    "sending": "發送中...",
    "backToLogin": "返回登入",
    "backToLoginArrow": "← 返回登入",
    "resetLinkSent": "重設連結已發送至您的 Email",
    "resetLinkFailed": "發送重設連結失敗，請稍後再試",
    "checkEmailInfo": "請檢查您的郵箱，連結有效期限為 15 分鐘",
    "noEmailReceived": "沒有收到郵件？",
    "checkSpam": "請檢查垃圾郵件資料夾",
    "confirmEmailCorrect": "確認 Email 地址是否正確",
    "waitAndRetry": "等待幾分鐘後再嘗試",
    "emailRequired": "請輸入 Email 地址",
    "invalidEmailAddress": "請輸入有效的 Email 地址",
    "resetPassword": "重設密碼",
    "resetPasswordDesc": "為帳號 {username} 設定新密碼",
    "newPassword": "新密碼",
    "newPasswordPlaceholder": "至少 6 個字符",
    "resetting": "重設中...",
    "resetSuccess": "密碼重設成功！",
    "resetPasswordMessage": "密碼已成功重設，請重新登入",
    "resetPasswordFailed": "重設密碼失敗，請稍後再試",
    "goToLogin": "前往登入",
    "verifyingLink": "驗證連結中...",
    "linkInvalid": "連結無效或已過期",
    "resendLink": "重新發送連結",
    "tokenInvalid": "Token 無效或已過期",
    "tokenVerifyError": "驗證 Token 時發生錯誤",
    "missingToken": "缺少 Token 參數",
    "passwordStrength": {
      "weak": "弱",
      "medium": "中等",
      "good": "良好",
      "strong": "強",
      "veryStrong": "非常強"
    },
    "verifyEmail": "Email 驗證",
    "verifying": "驗證中...",
    "verifyingDesc": "請稍候，正在驗證您的 Email",
    "verifySuccess": "Email 驗證成功！",
    "verifyFailed": "驗證失敗",
    "verifyError": "驗證過程中發生錯誤，請稍後再試",
    "verifyNowYouCan": "您現在可以：",
    "verifyFullOrdering": "使用完整的訂餐功能",
    "verifyManageProfile": "管理個人資料和偏好設定",
    "verifyOrderHistory": "查看完整訂單歷史",
    "verifyExclusive": "獲得專屬優惠和推薦",
    "startOrdering": "開始訂餐",
    "viewProfile": "查看個人資料",
    "possibleReasons": "可能的原因：",
    "linkExpired": "驗證連結已過期（有效期 24 小時）",
    "linkUsed": "此連結已被使用過",
    "linkInvalidReason": "連結格式不正確",
    "resendVerification": "重新發送驗證郵件",
    "missingVerifyToken": "缺少驗證 Token"
  },
  "toast": {
    "orderSubmitSuccess": "訂單提交成功！",
    "orderSubmitFailed": "訂單提交失敗，請重試",
    "itemRemoved": "已移除 {name}",
    "cartCannotBeEmpty": "購物車不能為空",
    "scanSuccess": "掃描成功！",
    "scanTypeDetected": "掃描到{type}！",
    "cameraInitFailed": "相機初始化失敗",
    "flashToggleFailed": "無法切換閃光燈",
    "couponApplied": "優惠券已套用！節省 ${amount}",
    "couponFailed": "優惠券驗證失敗",
    "couponValidationError": "驗證過程中發生錯誤，請稍後再試",
    "couponCodeRequired": "請輸入優惠券代碼",
    "couponCodeTooLong": "優惠券代碼不能超過50個字符",
    "couponCodeInvalidChars": "優惠券代碼只能包含字母、數字、連字符和下劃線",
    "deliveryAddressRequired": "請輸入外送地址",
    "invalidPhoneNumber": "請輸入有效的聯絡電話",
    "orderCancelFailed": "取消訂單失敗",
    "appLoadFailed": "應用載入失敗，請刷新頁面重試",
    "unexpectedError": "發生未預期的錯誤",
    "cameraNotSupported": "您的設備不支援相機功能",
    "orderSent": "訂單已送出！",
    "orderSendFailed": "訂單送出失敗，請稍後再試",
    "orderCancelled": "訂單已取消",
    "orderStatusUpdated": "訂單狀態已更新：{status}",
    "cancelOrderFailed": "取消訂單失敗，請稍後再試",
    "scanFailed": "掃描功能啟動失敗",
    "invalidQRFormat": "無效的QR碼格式",
    "qrValidationFailed": "QR碼資料驗證失敗",
    "unsupportedQRType": "不支援的QR碼類型",
    "qrProcessError": "處理QR碼時發生錯誤",
    "cameraAccessFailed": "相機存取失敗",
    "cameraPermissionRequired": "請允許相機權限以使用掃描功能",
    "noCameraFound": "找不到可用的相機",
    "browserNoCamera": "您的瀏覽器不支援相機功能",
    "errorReportCopied": "錯誤報告已複製到剪貼板，請貼上至問題回報表單中。",
    "verificationSuccess": "驗證成功！",
    "preparingMenu": "正在為您準備菜單...",
    "restaurantLoadFailed": "無法載入餐廳資訊",
    "invalidQRCode": "無效的 QR Code",
    "shopModeNotEnabled": "此餐廳未啟用店家模式",
    "phoneVerifyError": "請輸入正確的手機後3位數字"
  },
  "orderTracking": {
    "title": "訂單追蹤",
    "orderNumber": "訂單編號:",
    "loadingOrder": "載入訂單資訊中...",
    "loadFailed": "載入失敗",
    "reload": "重新載入",
    "orderProgress": "訂單進度",
    "estimatedMinutes": "預估還需 {minutes} 分鐘",
    "orderTimeline": "訂單時間軸",
    "orderDetails": "訂單詳情",
    "orderTime": "下單時間",
    "customerName": "顧客姓名",
    "tableNumber": "桌號",
    "orderedItems": "訂購餐點",
    "orderNotes": "訂單備註",
    "cancelOrder": "取消訂單",
    "continueOrdering": "繼續點餐",
    "confirmCancel": "確認取消訂單",
    "confirmCancelMessage": "確定要取消這個訂單嗎？此操作無法撤銷。",
    "confirmCancelBtn": "確認取消",
    "keepOrder": "保留訂單",
    "reconnecting": "連接已斷開，正在重新連接...",
    "timeline": {
      "created": "訂單已建立",
      "createdDesc": "您的訂單已成功送出",
      "confirmed": "訂單已確認",
      "confirmedDesc": "餐廳已確認您的訂單",
      "preparing": "正在製作",
      "preparingDesc": "廚房正在準備您的餐點",
      "ready": "準備完成",
      "readyDesc": "您的餐點已準備好",
      "served": "已送達",
      "servedDesc": "餐點已送到您的桌上",
      "cancelled": "訂單已取消",
      "cancelledDesc": "此訂單已被取消"
    },
    "status": {
      "pending": "待確認",
      "confirmed": "已確認",
      "preparing": "製作中",
      "ready": "準備完成",
      "served": "已送達",
      "cancelled": "已取消",
      "paid": "已完成"
    }
  },
  "orderHistory": {
    "title": "我的訂單",
    "personalCenter": "個人中心",
    "logout": "登出",
    "statusFilter": "訂單狀態",
    "allStatus": "全部狀態",
    "statusPending": "待確認",
    "statusConfirmed": "已確認",
    "statusPreparing": "準備中",
    "statusCompleted": "已完成",
    "statusServed": "已送達",
    "statusPaid": "已付款",
    "statusCancelled": "已取消",
    "startDate": "開始日期",
    "endDate": "結束日期",
    "resetFilter": "重置篩選",
    "noOrders": "暫無訂單",
    "noOrdersDesc": "您還沒有任何訂單記錄",
    "startOrdering": "開始點餐",
    "restaurant": "餐廳：",
    "table": "桌號：",
    "itemCount": "共 {count} 項商品",
    "paid": "已付款",
    "unpaid": "待付款",
    "viewDetails": "查看詳情",
    "prevPage": "上一頁",
    "nextPage": "下一頁",
    "pageInfo": "第 {current} / {total} 頁 （共 {count} 筆）",
    "confirmCancelOrder": "確定要取消這個訂單嗎？",
    "confirmLogout": "確定要登出嗎？"
  },
  "shopCart": {
    "title": "購物車",
    "empty": "購物車是空的",
    "pickupMethod": "取餐方式",
    "takeaway": "🛍️ 外帶",
    "delivery": "🛵 外送",
    "deliveryAddress": "外送地址 *",
    "deliveryAddressPlaceholder": "請輸入外送地址...",
    "contactPhone": "聯絡電話 *",
    "contactPhonePlaceholder": "0912-345-678",
    "deliveryNotes": "配送備註",
    "deliveryNotesPlaceholder": "大樓密碼、放門口...",
    "estimatedPickup": "預計取餐時間",
    "estimatedTime": "約 15-20 分鐘",
    "notes": "備註:",
    "subtotal": "小計",
    "deliveryFee": "外送費",
    "total": "合計",
    "pickupNumber": "取餐號碼:",
    "confirmOrder": "確認訂單",
    "processing": "處理中..."
  },
  "errorBoundary": {
    "reload": "重新載入",
    "goHome": "回到首頁",
    "showDetails": "顯示錯誤詳情",
    "persistentIssue": "問題持續發生？",
    "reportIssue": "回報問題",
    "networkErrorTitle": "網路連線失敗",
    "networkErrorMessage": "請檢查您的網路連線後重試",
    "notFoundTitle": "頁面不存在",
    "notFoundMessage": "您要查看的頁面可能已被移除或網址有誤",
    "permissionTitle": "存取被拒絕",
    "permissionMessage": "您沒有權限存取此頁面",
    "defaultTitle": "發生錯誤",
    "defaultMessage": "很抱歉，系統發生了問題，請稍後再試",
    "copyErrorReport": "請複製以下錯誤報告並回報給我們："
  },
  "manualInput": {
    "title": "輸入餐廳資訊",
    "restaurantId": "餐廳ID",
    "restaurantIdPlaceholder": "請輸入餐廳ID",
    "tableNumber": "桌號",
    "tableNumberPlaceholder": "請輸入桌號",
    "helpTitle": "找不到餐廳和桌號資訊？",
    "helpDesc": "請聯繫餐廳服務人員，或使用桌上的QR Code掃描進入。",
    "verifying": "驗證中...",
    "restaurantIdRequired": "請輸入餐廳ID",
    "restaurantIdNumeric": "餐廳ID必須為數字",
    "restaurantIdPositive": "餐廳ID必須大於0",
    "tableNumberRequired": "請輸入桌號",
    "tableNumberNumeric": "桌號必須為數字",
    "tableNumberPositive": "桌號必須大於0"
  },
  "qrScanView": {
    "title": "掃描QR碼",
    "instruction": "請將QR碼對準掃描框內",
    "manualInputLink": "無法掃描？點此手動輸入",
    "scanFailed": "掃描失敗",
    "processing": "正在處理...",
    "startingCamera": "正在啟動相機...",
    "aimAtQR": "請對準QR碼"
  },
  "shopMenu": {
    "loadingMenu": "正在載入菜單...",
    "loadFailed": "載入失敗",
    "reload": "重新載入",
    "searchPlaceholder": "搜尋菜品...",
    "recommended": "🌟 推薦菜品",
    "noItemsInCategory": "此分類暫無可用菜品",
    "noResults": "找不到相關菜品",
    "tryOtherKeywords": "試試其他關鍵字",
    "viewCart": "查看購物車"
  },
  "phoneVerification": {
    "title": "手機驗證",
    "enterLastDigits": "請輸入手機號碼後3位",
    "forIdentification": "用於識別您的訂單",
    "lastDigits": "手機後3位",
    "placeholder": "請輸入3位數字",
    "example": "例如：手機號 0912345678，請輸入 678",
    "startOrdering": "開始點餐",
    "verifyingStatus": "驗證中...",
    "whyNeeded": "為什麼需要手機驗證？",
    "whyNeededDesc": "輸入手機後3位可以幫助我們快速識別您的訂單，讓您在取餐時更加便捷。"
  },
  "menuItemCard": {
    "featured": "⭐ 招牌推薦",
    "unavailable": "暫不供應",
    "soldOut": "售完",
    "addToCart": "加入",
    "selectSpec": "選擇規格",
    "orderedCount": "{count} 人點過"
  },
  "menuItemModal": {
    "featured": "⭐ 招牌推薦",
    "quantity": "數量",
    "notesLabel": "備註（選填）",
    "notesPlaceholder": "有什麼特別需求嗎？例如：不要辣、少冰等...",
    "unavailable": "暫不供應",
    "soldOut": "售完",
    "addToCart": "加入購物車 · ${price}"
  },
  "orderItem": {
    "unknownItem": "未知商品",
    "notes": "備註：",
    "statusPending": "待處理",
    "statusPreparing": "製作中",
    "statusReady": "準備完成",
    "statusServed": "已送達"
  },
  "errorView": {
    "retry": "重新嘗試",
    "goHome": "回到首頁"
  },
  "orderTypeLanding": {
    "selectMethod": "請選擇取餐方式",
    "takeaway": "外帶 Takeaway",
    "takeawayDesc": "到店自取",
    "delivery": "外送 Delivery",
    "deliveryDesc": "送到指定地址",
    "continue": "繼續"
  }
}
```

Note: The `...existing keys...` notation means copy the corresponding section from `apps/customer-app/src/i18n/locales/zh-TW.json` verbatim. All sections except `common`, `validation`, and `time` (which moved to common.json) must be included.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/i18n/src/locales/zh-TW/customer.json
git commit -m "feat(i18n): create zh-TW customer.json with all customer-app translations"
```

---

### Task 6: Create customer.json for remaining 5 locales

**Files:**

- Create: `packages/shared/src/i18n/src/locales/en-US/customer.json`
- Create: `packages/shared/src/i18n/src/locales/zh-CN/customer.json`
- Create: `packages/shared/src/i18n/src/locales/vi-VN/customer.json`
- Create: `packages/shared/src/i18n/src/locales/ms-MY/customer.json`
- Create: `packages/shared/src/i18n/src/locales/id-ID/customer.json`

- [ ] **Step 1: Create en-US/customer.json**

Use the exact same key structure as zh-TW/customer.json. For the existing sections (navigation, home, qrScan, menu, menuItem, customization, cart, order, service, payment, profile, errors, restaurant, about, privacy, terms), copy from `apps/customer-app/src/i18n/locales/en.json`.

For the NEW sections (auth, toast, orderTracking, orderHistory, shopCart, errorBoundary, manualInput, qrScanView, shopMenu, phoneVerification, menuItemCard, menuItemModal, orderItem, errorView, orderTypeLanding), translate the zh-TW values to English.

- [ ] **Step 2: Create zh-CN/customer.json**

Same structure. Copy existing sections from `apps/customer-app/src/i18n/locales/zh-CN.json`. Translate new sections from zh-TW to Simplified Chinese.

- [ ] **Step 3: Create vi-VN/customer.json**

Same structure. Copy existing sections from `apps/customer-app/src/i18n/locales/vi.json`. Translate new sections from en-US to Vietnamese.

- [ ] **Step 4: Create ms-MY/customer.json**

Same structure. Translate all sections from en-US to Malay.

- [ ] **Step 5: Create id-ID/customer.json**

Same structure. Translate all sections from en-US to Indonesian.

- [ ] **Step 6: Verify all 6 locale files have identical key structure**

Run a quick script to compare keys:

```bash
cd packages/shared/src/i18n
node -e "
const locales = ['en-US','zh-TW','zh-CN','vi-VN','ms-MY','id-ID'];
const counts = locales.map(l => {
  const c = require('./src/locales/'+l+'/common.json');
  const k = require('./src/locales/'+l+'/customer.json');
  const keys = JSON.stringify({...c,...k}).match(/\"[^\"]+\":/g).length;
  return l+': '+keys+' keys';
});
console.log(counts.join('\n'));
"
```

All locales should have the same key count.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/i18n/src/locales/
git commit -m "feat(i18n): create customer.json for en-US, zh-CN, vi-VN, ms-MY, id-ID"
```

---

### Task 7: Create static-messages.ts

**Files:**

- Create: `packages/shared/src/i18n/src/static-messages.ts`

- [ ] **Step 1: Write static-messages.ts**

```typescript
/**
 * Static message loader for customer-app
 * All locale messages are imported at build time for instant availability
 */

// en-US
import enUSCommon from "./locales/en-US/common.json";
import enUSCustomer from "./locales/en-US/customer.json";

// zh-TW
import zhTWCommon from "./locales/zh-TW/common.json";
import zhTWCustomer from "./locales/zh-TW/customer.json";

// zh-CN
import zhCNCommon from "./locales/zh-CN/common.json";
import zhCNCustomer from "./locales/zh-CN/customer.json";

// vi-VN
import viVNCommon from "./locales/vi-VN/common.json";
import viVNCustomer from "./locales/vi-VN/customer.json";

// ms-MY
import msMYCommon from "./locales/ms-MY/common.json";
import msMYCustomer from "./locales/ms-MY/customer.json";

// id-ID
import idIDCommon from "./locales/id-ID/common.json";
import idIDCustomer from "./locales/id-ID/customer.json";

import type { SupportedLocale } from "./types";

function mergeMessages(
  common: Record<string, any>,
  customer: Record<string, any>,
) {
  return { ...common, ...customer };
}

export function getCustomerMessages(): Record<
  SupportedLocale,
  Record<string, any>
> {
  return {
    "en-US": mergeMessages(enUSCommon, enUSCustomer),
    "zh-TW": mergeMessages(zhTWCommon, zhTWCustomer),
    "zh-CN": mergeMessages(zhCNCommon, zhCNCustomer),
    "vi-VN": mergeMessages(viVNCommon, viVNCustomer),
    "ms-MY": mergeMessages(msMYCommon, msMYCustomer),
    "id-ID": mergeMessages(idIDCommon, idIDCustomer),
  };
}

export function getAdminMessages(): Record<string, Record<string, any>> {
  // Placeholder for future admin-dashboard integration
  return {
    "en-US": enUSCommon,
    "zh-TW": zhTWCommon,
  };
}
```

- [ ] **Step 2: Build and verify**

Run: `cd packages/shared/src/i18n && pnpm build`
Expected: PASS — `dist/static-messages.js` and `dist/static-messages.d.ts` generated

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/i18n/src/static-messages.ts
git commit -m "feat(i18n): add static-messages.ts for build-time locale loading"
```

---

## Chunk 4: Customer-App Integration

### Task 8: Rewrite customer-app i18n layer

**Files:**

- Modify: `apps/customer-app/src/i18n/index.ts`
- Modify: `apps/customer-app/src/composables/useI18n.ts`
- Modify: `apps/customer-app/src/components/LanguageSwitcher.vue`
- Delete: `apps/customer-app/src/i18n/locales/zh-TW.json`
- Delete: `apps/customer-app/src/i18n/locales/zh-CN.json`
- Delete: `apps/customer-app/src/i18n/locales/en.json`
- Delete: `apps/customer-app/src/i18n/locales/vi.json`

- [ ] **Step 1: Rewrite i18n/index.ts**

Replace the entire file:

```typescript
import { createI18n } from "vue-i18n";
import type { App } from "vue";
import {
  LocaleManager,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type LocaleInfo,
} from "@makanmakan/i18n";
import { getCustomerMessages } from "@makanmakan/i18n/static-messages";

// Load all translations statically
const messages = getCustomerMessages();

// Supported languages for this app
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;

export type SupportedLanguage = SupportedLocale;

export const DEFAULT_LANGUAGE: SupportedLanguage = "zh-TW";

// Create i18n instance
export const i18n = createI18n({
  legacy: false,
  locale: LocaleManager.getStoredLocale(),
  fallbackLocale: "en-US",
  globalInjection: true,
  messages,
});

// Vue plugin install
export function setupI18n(app: App) {
  app.use(i18n);
}

// Switch language
export function switchLanguage(language: SupportedLanguage) {
  i18n.global.locale.value = language;
  LocaleManager.setLocale(language);
}

// Get current language info
export function getLanguageInfo(locale: SupportedLanguage): LocaleInfo {
  return LocaleManager.getLocaleInfo(locale);
}
```

- [ ] **Step 2: Update composables/useI18n.ts**

Replace the imports and update the composable. The API surface stays the same:

```typescript
import { computed, type ComputedRef } from "vue";
import { useI18n as useVueI18n } from "vue-i18n";
import {
  switchLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";
import type { LocaleInfo } from "@makanmakan/i18n";

interface UseI18nReturn {
  t: (key: string) => string;
  safeT: (key: string, defaultValue?: string) => string;
  tWithParams: (key: string, params: Record<string, any>) => string;
  tPlural: (key: string, count: number, params?: Record<string, any>) => string;
  currentLanguage: ComputedRef<SupportedLanguage>;
  currentLanguageInfo: ComputedRef<LocaleInfo | undefined>;
  supportedLanguages: ComputedRef<typeof SUPPORTED_LANGUAGES>;
  changeLanguage: (language: SupportedLanguage) => void;
  hasTranslation: (key: string) => boolean;
}

export function useI18n(): UseI18nReturn {
  const { t, locale, te } = useVueI18n();

  const currentLanguage = computed(() => locale.value as SupportedLanguage);

  const currentLanguageInfo = computed(() =>
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage.value),
  );

  const supportedLanguages = computed(() => SUPPORTED_LANGUAGES);

  const changeLanguage = (language: SupportedLanguage) => {
    switchLanguage(language);
  };

  const hasTranslation = (key: string) => {
    return te(key);
  };

  const safeT = (key: string, defaultValue?: string) => {
    return hasTranslation(key) ? t(key) : defaultValue || key;
  };

  const tWithParams = (key: string, params: Record<string, any>) => {
    return t(key, params);
  };

  const tPlural = (
    key: string,
    count: number,
    params?: Record<string, any>,
  ) => {
    return t(key, { count, ...params }, count);
  };

  return {
    t,
    safeT,
    tWithParams,
    tPlural,
    currentLanguage,
    currentLanguageInfo,
    supportedLanguages,
    changeLanguage,
    hasTranslation,
  };
}
```

- [ ] **Step 3: Update LanguageSwitcher.vue**

In `LanguageSwitcher.vue`, update the import to use `SUPPORTED_LANGUAGES` from the new `@/i18n`. The component should already work since we're re-exporting `SUPPORTED_LOCALES` as `SUPPORTED_LANGUAGES`. Check that the language code references work (the component iterates over `supportedLanguages` from the composable).

The main change: the language codes are now `en-US` and `vi-VN` instead of `en` and `vi`. Make sure the LanguageSwitcher iterates using `.code` property which will be the full locale code.

- [ ] **Step 4: Delete old locale files**

```bash
rm apps/customer-app/src/i18n/locales/zh-TW.json
rm apps/customer-app/src/i18n/locales/zh-CN.json
rm apps/customer-app/src/i18n/locales/en.json
rm apps/customer-app/src/i18n/locales/vi.json
rmdir apps/customer-app/src/i18n/locales/
```

- [ ] **Step 5: Verify build**

Run: `cd apps/customer-app && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/customer-app/src/i18n/ apps/customer-app/src/composables/useI18n.ts apps/customer-app/src/components/LanguageSwitcher.vue
git commit -m "feat(i18n): integrate customer-app with shared i18n package"
```

---

## Chunk 5: Fix Hardcoded Strings — Priority 1

### Task 9: Fix App.vue

**Files:**

- Modify: `apps/customer-app/src/App.vue`

- [ ] **Step 1: Add i18n import and fix hardcoded strings**

Add `import { useI18n } from "@/composables/useI18n"` and destructure `{ t }`.

Replace:

- `載入中...` → `{{ t('common.loadingApp') }}`
- `應用載入失敗，請刷新頁面重試` → `t('toast.appLoadFailed')`
- `發生未預期的錯誤` → `t('toast.unexpectedError')`

Console errors stay as-is (not translated).

- [ ] **Step 2: Commit**

```bash
git add apps/customer-app/src/App.vue
git commit -m "fix(i18n): replace hardcoded strings in App.vue"
```

---

### Task 10: Fix CartView.vue

**Files:**

- Modify: `apps/customer-app/src/views/CartView.vue`

- [ ] **Step 1: Replace all hardcoded strings**

CartView already imports `useI18n`. Replace these strings:

| Line     | Old                                            | New                                                                   |
| -------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| ~177     | `最低消費：${{...}}`                           | `{{ t('cart.minimumOrderNote', { amount: formatPrice(...) }) }}`      |
| ~183     | `還需加點 ${{...}} 才能下單`                   | `{{ t('cart.minimumOrderShortfall', { amount: formatPrice(...) }) }}` |
| ~186     | `已達到最低消費標準 ✓`                         | `{{ t('cart.minimumOrderMet') }}`                                     |
| ~600     | Template literal confirm message               | `t('cart.confirmOrderMessage', { amount: formatPrice(totalAmount) })` |
| ~701     | `訂單提交成功！`                               | `t('toast.orderSubmitSuccess')`                                       |
| ~708     | `訂單提交失敗，請重試`                         | `t('toast.orderSubmitFailed')`                                        |
| ~777     | `已移除 ${item.menuItem.name}`                 | `t('toast.itemRemoved', { name: item.menuItem.name })`                |
| ~784     | `購物車不能為空`                               | `t('toast.cartCannotBeEmpty')`                                        |
| ~804,810 | `請輸入優惠券代碼`                             | `t('toast.couponCodeRequired')`                                       |
| ~814     | `優惠券代碼不能超過50個字符`                   | `t('toast.couponCodeTooLong')`                                        |
| ~821     | `優惠券代碼只能包含字母、數字、連字符和下劃線` | `t('toast.couponCodeInvalidChars')`                                   |
| ~869     | `優惠券已套用！節省 $${...}`                   | `t('toast.couponApplied', { amount: formatPrice(...) })`              |
| ~875     | `優惠券驗證失敗`                               | `t('toast.couponFailed')`                                             |
| ~882     | `驗證過程中發生錯誤，請稍後再試`               | `t('toast.couponValidationError')`                                    |
| ~955     | `date.toLocaleDateString("zh-TW", ...)`        | Use `currentLanguage.value` instead of hardcoded `"zh-TW"`            |

- [ ] **Step 2: Commit**

```bash
git add apps/customer-app/src/views/CartView.vue
git commit -m "fix(i18n): replace hardcoded strings in CartView.vue"
```

---

### Task 11: Fix LoginView.vue and RegisterView.vue

**Files:**

- Modify: `apps/customer-app/src/views/LoginView.vue`
- Modify: `apps/customer-app/src/views/RegisterView.vue`

- [ ] **Step 1: Add i18n to LoginView.vue**

Add `import { useI18n } from "@/composables/useI18n"` and `const { t } = useI18n()` in setup.

Replace all hardcoded strings with `t('auth.*')` keys:

- `會員登入` → `{{ t('auth.memberLogin') }}`
- `帳號` → `{{ t('auth.username') }}`
- `請輸入帳號` → `t('auth.usernamePlaceholder')`
- `密碼` → `{{ t('auth.password') }}`
- `請輸入密碼` → `t('auth.passwordPlaceholder')`
- `忘記密碼？` → `{{ t('auth.forgotPassword') }}`
- `登入中...` / `登入` → `{{ isSubmitting ? t('auth.loggingIn') : t('auth.login') }}`
- `還沒有帳號？` → `{{ t('auth.noAccount') }}`
- `立即註冊` → `{{ t('auth.registerNow') }}`
- `以訪客身分繼續瀏覽` → `{{ t('auth.guestBrowse') }}`
- Validation: `請輸入帳號` → `t('auth.usernameRequired')`, `請輸入密碼` → `t('auth.passwordRequired')`, `密碼至少需要6個字符` → `t('auth.passwordMinLength')`
- Error: `登入失敗` → `t('auth.loginFailed')`, `登入過程中發生錯誤` → `t('auth.loginError')`

- [ ] **Step 2: Add i18n to RegisterView.vue**

Same pattern. Add `useI18n` import and replace all hardcoded strings with `t('auth.*')` keys.

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/views/LoginView.vue apps/customer-app/src/views/RegisterView.vue
git commit -m "fix(i18n): replace hardcoded strings in LoginView and RegisterView"
```

---

## Chunk 6: Fix Hardcoded Strings — Priority 2

### Task 12: Fix OrderTrackingView.vue and OrderHistoryView.vue

**Files:**

- Modify: `apps/customer-app/src/views/OrderTrackingView.vue`
- Modify: `apps/customer-app/src/views/OrderHistoryView.vue`

- [ ] **Step 1: Add i18n to OrderTrackingView.vue and replace ~31 hardcoded strings**

Add `useI18n` import. Replace all strings using `t('orderTracking.*')` and `t('toast.*')` keys. Key mappings:

- Page labels → `orderTracking.title`, `orderTracking.orderNumber`, etc.
- Timeline statuses → `orderTracking.timeline.created`, `.confirmedDesc`, etc.
- Status map → `orderTracking.status.pending`, `.confirmed`, etc.
- Cancel modal → `orderTracking.confirmCancel`, `.confirmCancelMessage`, etc.
- Toast messages → `toast.orderCancelled`, `toast.cancelOrderFailed`

- [ ] **Step 2: Add i18n to OrderHistoryView.vue and replace ~29 hardcoded strings**

Add `useI18n` import. Replace all strings using `t('orderHistory.*')` keys.

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/views/OrderTrackingView.vue apps/customer-app/src/views/OrderHistoryView.vue
git commit -m "fix(i18n): replace hardcoded strings in OrderTracking and OrderHistory views"
```

---

### Task 13: Fix QRScanView.vue and ShopCartModal.vue

**Files:**

- Modify: `apps/customer-app/src/views/QRScanView.vue`
- Modify: `apps/customer-app/src/components/ShopCartModal.vue`

- [ ] **Step 1: Add i18n to QRScanView.vue and replace ~14+ hardcoded strings**

Add `useI18n` import. Replace strings using `t('qrScanView.*')` and `t('toast.*')` keys.

- [ ] **Step 2: Add i18n to ShopCartModal.vue and replace ~14+ hardcoded strings**

Add `useI18n` import. Replace strings using `t('shopCart.*')` and `t('toast.*')` keys.

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/views/QRScanView.vue apps/customer-app/src/components/ShopCartModal.vue
git commit -m "fix(i18n): replace hardcoded strings in QRScanView and ShopCartModal"
```

---

### Task 14: Fix ErrorBoundary.vue and remaining components

**Files:**

- Modify: `apps/customer-app/src/components/ErrorBoundary.vue`
- Modify: `apps/customer-app/src/components/OrderItemCard.vue`
- Modify: `apps/customer-app/src/components/MenuItemModal.vue`
- Modify: `apps/customer-app/src/components/MenuItemCard.vue`
- Modify: `apps/customer-app/src/components/CartItemCard.vue`
- Modify: `apps/customer-app/src/components/ManualInputModal.vue`

- [ ] **Step 1: Fix ErrorBoundary.vue**

Add `useI18n` import. Replace ~16 hardcoded strings using `t('errorBoundary.*')` keys.

- [ ] **Step 2: Fix OrderItemCard.vue**

Add `useI18n` import. Replace status map and labels using `t('orderItem.*')` keys.

- [ ] **Step 3: Fix MenuItemModal.vue and MenuItemCard.vue**

Add `useI18n` import. Replace dietary labels, status strings, and button text using `t('menuItemModal.*')` and `t('menuItemCard.*')` keys.

- [ ] **Step 4: Fix CartItemCard.vue**

Add `useI18n` import. Replace toggle text using `t('cart.hideNotes')` / `t('cart.addNotes')` keys (these already exist).

- [ ] **Step 5: Fix ManualInputModal.vue**

Add `useI18n` import. Replace ~8+ hardcoded strings using `t('manualInput.*')` keys.

- [ ] **Step 6: Commit**

```bash
git add apps/customer-app/src/components/ErrorBoundary.vue apps/customer-app/src/components/OrderItemCard.vue apps/customer-app/src/components/MenuItemModal.vue apps/customer-app/src/components/MenuItemCard.vue apps/customer-app/src/components/CartItemCard.vue apps/customer-app/src/components/ManualInputModal.vue
git commit -m "fix(i18n): replace hardcoded strings in 6 components"
```

---

## Chunk 7: Fix Hardcoded Strings — Priority 3

### Task 15: Fix auth/verification views

**Files:**

- Modify: `apps/customer-app/src/views/ForgotPasswordView.vue`
- Modify: `apps/customer-app/src/views/ResetPasswordView.vue`
- Modify: `apps/customer-app/src/views/VerifyEmailView.vue`

- [ ] **Step 1: Fix ForgotPasswordView.vue**

Add `useI18n` import. Replace ~14 hardcoded strings using `t('auth.*')` keys.

- [ ] **Step 2: Fix ResetPasswordView.vue**

Add `useI18n` import. Replace ~23 hardcoded strings using `t('auth.*')` keys. Pay special attention to password strength indicators: `t('auth.passwordStrength.weak')`, etc.

- [ ] **Step 3: Fix VerifyEmailView.vue**

Add `useI18n` import. Replace ~20 hardcoded strings using `t('auth.*')` keys.

- [ ] **Step 4: Commit**

```bash
git add apps/customer-app/src/views/ForgotPasswordView.vue apps/customer-app/src/views/ResetPasswordView.vue apps/customer-app/src/views/VerifyEmailView.vue
git commit -m "fix(i18n): replace hardcoded strings in auth/verification views"
```

---

### Task 16: Fix remaining views

**Files:**

- Modify: `apps/customer-app/src/views/HomeView.vue`
- Modify: `apps/customer-app/src/views/MenuView.vue`
- Modify: `apps/customer-app/src/views/ShopMenuView.vue`
- Modify: `apps/customer-app/src/views/OrderTypeLandingView.vue`
- Modify: `apps/customer-app/src/views/ShopPhoneVerificationView.vue`
- Modify: `apps/customer-app/src/views/ErrorView.vue`

- [ ] **Step 1: Fix MenuView.vue (already has useI18n — fix 4 remaining hardcoded strings)**

Replace loading/error messages using existing `t()` calls.

- [ ] **Step 2: Fix ShopMenuView.vue**

Add `useI18n` import. Replace ~9 hardcoded strings using `t('shopMenu.*')` keys.

- [ ] **Step 3: Fix OrderTypeLandingView.vue**

Add `useI18n` import. Replace ~5+ strings using `t('orderTypeLanding.*')` keys.

- [ ] **Step 4: Fix ShopPhoneVerificationView.vue**

Add `useI18n` import. Replace ~12 strings using `t('phoneVerification.*')` and `t('toast.*')` keys.

- [ ] **Step 5: Fix ErrorView.vue**

Add `useI18n` import. Replace 2 strings using `t('errorView.*')` keys.

- [ ] **Step 6: HomeView.vue — already mostly i18n compliant, only 1 console warning to ignore**

No changes needed (console warnings are not translated per spec).

- [ ] **Step 7: Commit**

```bash
git add apps/customer-app/src/views/
git commit -m "fix(i18n): replace hardcoded strings in remaining views"
```

---

### Task 17: Fix group order components

**Files:**

- Modify: `apps/customer-app/src/components/group/GroupCartPanel.vue`
- Modify: `apps/customer-app/src/components/group/SplitBillSelector.vue`

- [ ] **Step 1: Update GroupCartPanel.vue Chinese fallback defaults**

This component already uses `t()` but has Chinese fallback strings as defaults (e.g., `t('group.unknownMember', '未知成員')`). These should work as-is once the translation keys exist, but verify the keys are in the locale files.

- [ ] **Step 2: Verify SplitBillSelector.vue**

Same pattern — verify translation keys exist.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add apps/customer-app/src/components/group/
git commit -m "fix(i18n): update group component i18n fallbacks"
```

---

## Chunk 8: Verification

### Task 18: Build and typecheck

- [ ] **Step 1: Build shared i18n package**

Run: `cd packages/shared/src/i18n && pnpm build`
Expected: PASS — dist/ generated with static-messages.js

- [ ] **Step 2: Typecheck customer-app**

Run: `cd apps/customer-app && pnpm typecheck`
Expected: PASS — 0 TypeScript errors

- [ ] **Step 3: Full monorepo typecheck**

Run: `pnpm typecheck`
Expected: PASS across all packages

- [ ] **Step 4: Scan for remaining hardcoded Chinese strings**

Run a grep to verify no hardcoded Chinese remains in user-facing code:

```bash
grep -rn '[\u4e00-\u9fff]' apps/customer-app/src/ --include="*.vue" --include="*.ts" | grep -v 'console\.' | grep -v '\/\/' | grep -v 'node_modules' | head -30
```

Expected: Only console messages and comments should appear. No template or toast strings.

- [ ] **Step 5: Commit any final fixes**

### Task 19: Final commit and verification

- [ ] **Step 1: Run dev server**

Run: `cd apps/customer-app && pnpm dev`
Verify: App starts without errors, language switcher shows 6 languages, switching languages updates all text.

- [ ] **Step 2: Create summary commit**

If any loose ends were fixed:

```bash
git add -A
git commit -m "chore(i18n): customer-app i18n integration complete — 6 locales, 0 hardcoded strings"
```
