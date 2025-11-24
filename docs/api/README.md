# API Documentation / API 文檔

MakanMakan REST API 文檔與使用指南。

## 📂 文件夾結構

### 📍 Endpoints (`endpoints/`)
各 API 端點的詳細文檔（待建立）

建議結構:
- `auth.md` - 認證 API
- `restaurants.md` - 餐廳管理 API
- `menu.md` - 菜單管理 API
- `orders.md` - 訂單管理 API
- `tables.md` - 桌位管理 API
- `partnerships.md` - 合作夥伴 API

### 📋 Schemas (`schemas/`)
API Schema 定義（待建立）

### 📚 Guides (`guides/`)
API 使用指南

- `API_PAGINATION_GUIDE.md` - 分頁指南

---

## 🔌 API 概覽

### Base URL

```
Production:  https://api.makanmakan.com/v1
Staging:     https://staging-api.makanmakan.com/v1
Local:       http://localhost:8787/api/v1
```

### 認證

所有受保護的 API 端點需要 JWT Bearer Token:

```http
Authorization: Bearer <your_jwt_token>
```

---

## 📖 API 端點總覽

### 🔐 Authentication (`/auth`)
- `POST /auth/register` - 註冊
- `POST /auth/login` - 登入
- `POST /auth/refresh` - 刷新令牌
- `POST /auth/logout` - 登出

### 🏪 Restaurants (`/restaurants`)
- `GET /restaurants` - 取得餐廳列表
- `GET /restaurants/:id` - 取得餐廳詳情
- `POST /restaurants` - 創建餐廳 (Admin)
- `PUT /restaurants/:id` - 更新餐廳 (Shop Owner)
- `DELETE /restaurants/:id` - 刪除餐廳 (Admin)

### 🍽️ Menu (`/menu`)
- `GET /menu/:restaurant_id/items` - 取得菜單項目
- `GET /menu/:restaurant_id/categories` - 取得分類
- `POST /menu/:restaurant_id/items` - 新增菜單項目
- `PUT /menu/items/:id` - 更新菜單項目
- `DELETE /menu/items/:id` - 刪除菜單項目

### 📦 Orders (`/orders`)
- `GET /orders` - 取得訂單列表
- `GET /orders/:id` - 取得訂單詳情
- `POST /orders` - 創建訂單
- `PUT /orders/:id/status` - 更新訂單狀態
- `POST /orders/:id/items` - 新增訂單項目

### 🪑 Tables (`/tables`)
- `GET /tables/:restaurant_id` - 取得桌位列表
- `POST /tables/:restaurant_id` - 創建桌位
- `PUT /tables/:id` - 更新桌位
- `POST /tables/:id/qr` - 生成 QR 碼

### 👥 Users (`/users`)
- `GET /users/:restaurant_id` - 取得員工列表
- `POST /users/:restaurant_id` - 新增員工
- `PUT /users/:id` - 更新員工
- `DELETE /users/:id` - 刪除員工

### 🤝 Partnerships (`/partnerships`)
- `GET /partnerships/:restaurant_id` - 取得合作夥伴列表
- `POST /partnerships/:restaurant_id` - 創建合作夥伴
- `GET /partnerships/:id/plans` - 取得方案
- `POST /partnerships/:id/members` - 會員驗證

### ⚡ Realtime (`/realtime`)
- `POST /realtime/auth/token` - 生成 WebSocket 令牌
- `POST /realtime/auth/verify` - 驗證令牌

---

## 📊 回應格式

### 成功回應

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## 🔍 查詢參數

### 分頁

```
?page=1&per_page=20
```

詳見: `guides/API_PAGINATION_GUIDE.md`

### 過濾

```
?status=active&category=food
```

### 排序

```
?sort=created_at&order=desc
```

---

## 🚀 快速開始

### 使用 cURL

```bash
# 登入
curl -X POST https://api.makanmakan.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 取得菜單
curl https://api.makanmakan.com/v1/menu/123/items \
  -H "Authorization: Bearer <token>"
```

### 使用 JavaScript

```javascript
const response = await fetch('https://api.makanmakan.com/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
})

const data = await response.json()
```

---

## 🔗 相關文檔

- **OpenAPI Spec**: `/openapi.json` (開發中)
- **Swagger UI**: `/docs` (開發中)
- **架構文檔**: `docs/architecture/`
- **功能文檔**: `docs/features/`

---

**最後更新**: 2025-11-24
**API 版本**: v1
**端點總數**: 50+
