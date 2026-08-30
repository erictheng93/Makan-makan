# 第三方登入憑證申請指南（LINE / Google / Apple）

**適用對象**：要讓 MakanMasak 顧客能用 LINE、Google、Apple 帳號登入的人。
**前置**：後端已完成（commit `381b9a42`），程式碼在憑證缺席時會回 `503
OAUTH_PROVIDER_UNAVAILABLE`，不會壞掉，也不會把顧客導到會被拒絕的授權頁。
**建議順序**：**先做 LINE**，理由見下。其餘兩家可以之後再補，彼此獨立。

---

## 0. 為什麼先做 LINE

LINE 不只是「多一個登入選項」。目前 production 的顧客**完全註冊不了** —— 手機
OTP 沒有簡訊商憑證（回 503），email 驗證信走的 MailChannels 免費通道已停供（回
401 後 502）。

LINE 登入**不依賴簡訊也不依賴 email**，所以它接起來的那一刻，就是 production
第一條能用的註冊管道。這是它排第一的真正原因，不是市佔率。

（LINE 在台灣的普及率當然也是加分，但那是次要的。）

---

## 1. 三家共用的資訊

### 1.1 程式碼會讀的環境變數

| Provider | 非機密（放 `wrangler.toml` 的 `[vars]`） | 機密（一律 `wrangler secret put`） |
| --- | --- | --- |
| LINE | `LINE_LOGIN_CHANNEL_ID` | `LINE_LOGIN_CHANNEL_SECRET` |
| Google | `GOOGLE_OAUTH_CLIENT_ID` | `GOOGLE_OAUTH_CLIENT_SECRET` |
| Apple | `APPLE_CLIENT_ID`、`APPLE_TEAM_ID`、`APPLE_KEY_ID` | `APPLE_SIGN_IN_PRIVATE_KEY` |

**判定規則**：任一家只要少一個值，`isProviderConfigured()` 就判定該 provider
不可用，`GET /api/v1/customer/auth/oauth/providers` 不會列出它，前端也就不會出現
那顆按鈕。三家彼此獨立，缺 Apple 不影響 LINE。

### 1.2 Redirect URI（三家都要在各自主控台登記）

必須**逐字相符**，多一個斜線都會被拒絕：

```
正式  https://api.makanmasak.com/api/v1/customer/auth/oauth/line/callback
      https://api.makanmasak.com/api/v1/customer/auth/oauth/google/callback
      https://api.makanmasak.com/api/v1/customer/auth/oauth/apple/callback

本機  http://localhost:8787/api/v1/customer/auth/oauth/line/callback
      http://localhost:8787/api/v1/customer/auth/oauth/google/callback
      （Apple 不接受 localhost，見 §4.6）
```

這個字串由程式從 `API_BASE_URL` 推導（`services/oauth/providers.ts` 的
`buildRedirectUri`），不是從請求的 Host 組出來的 —— 因為經過 proxy 的請求可能帶
著 provider 沒看過的 host。所以**改 `API_BASE_URL` 就等於改 redirect URI**，改了
要回主控台同步。

### 1.3 設定 secret 的指令

```bash
cd apps/api
pnpm wrangler secret put <NAME> --env production
# 指令會互動式提示貼上值；值不會進 shell history
```

非機密的 client id 請直接編輯 `apps/api/wrangler.toml` 的
`[env.production.vars]`，**不要**放 secret（放了反而查不到、也無法在
`wrangler.toml` 裡被看見）。

> **注意**：`[vars]` 頂層區塊**不會**被 `[env.production.vars]` 繼承。這個 repo
> 為此踩過一次（`OTP_SMS_BRAND`），所以每個 env 區塊都要各自寫一份。

---

## 2. LINE Login（優先）

### 2.1 你需要先有的東西

- 一個 **LINE 帳號**（個人帳號即可開始）
- 若要以公司名義營運，需要 **LINE Business ID**；個人開發者可先用個人身分建立
  provider，之後再轉移
- 一個**可公開存取的隱私權政策網址**（申請 email 權限時要用，見 §2.5）

### 2.2 建立 Channel

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 建立或選擇一個 **Provider**（一個 Provider 底下可以有多個 Channel）
3. 在該 Provider 下點 **Create a new channel**，選 **LINE Login**
4. 填寫：
   - **Channel name** — 會顯示在顧客的授權同意畫面上，請用顧客認得的店名／品牌名
   - **Channel description**
   - **App types** — 勾選 **Web app**（一定要勾，否則後續拿不到 callback 設定）
   - **Email address** — 你的聯絡信箱
5. 同意條款並建立

### 2.3 取得 Channel ID 與 Channel secret

建立完成後進入該 Channel 的 **Basic settings** 分頁：

- **Channel ID** — 一串數字，這是 `LINE_LOGIN_CHANNEL_ID`
- **Channel secret** — 這是 `LINE_LOGIN_CHANNEL_SECRET`

### 2.4 登記 Callback URL

切到 **LINE Login** 分頁 → **Callback URL**，貼上：

```
https://api.makanmasak.com/api/v1/customer/auth/oauth/line/callback
http://localhost:8787/api/v1/customer/auth/oauth/line/callback
```

多個網址**一行一個**（LINE 官方文件明說用換行分隔，不是逗號）。

### 2.5 申請 email 權限（**位置很容易找錯**）

LINE 預設**不會**給你使用者的 email。要拿到必須另外申請，而申請入口**不在**
LINE Login 分頁，而在：

> **Basic settings** 分頁 → 往下捲到 **OpenID Connect** 區塊 →
> **Email address permission** 旁的 **Apply**

申請時要：

1. 勾選 **Request for email permission** 底下的兩個同意項目
2. **上傳一張截圖** —— 內容必須顯示你的網站如何告知使用者「我們會收集你的
   email」以及「我們拿它做什麼用」。也就是隱私權政策或註冊頁上那段說明的畫面。
3. （選填但建議）填入隱私權政策網址與服務條款網址

送出後，**Email address permission** 底下會顯示 **Applied**。

**沒有 email 權限會怎樣？** 系統仍然完全可用 —— 顧客照樣能用 LINE 註冊登入，只是
新帳號不會帶 email。差別在於「同一個人先用 email 註冊過、後來用 LINE 登入」時，
系統無法認出那是同一人，會建立第二個帳號。所以這一步不是必要，但會影響帳號合併
的品質，建議申請。

### 2.6 寫入設定

```bash
# 非機密：編輯 apps/api/wrangler.toml 的 [env.production.vars]
LINE_LOGIN_CHANNEL_ID = "1234567890"

# 機密：
cd apps/api
pnpm wrangler secret put LINE_LOGIN_CHANNEL_SECRET --env production
```

然後部署：

```bash
cd apps/api && pnpm wrangler deploy --env production
```

### 2.7 驗證

```bash
# 應該要看到 "line" 出現在清單裡
curl -s https://api.makanmasak.com/api/v1/customer/auth/oauth/providers

# 應該回 302，Location 指向 access.line.me
curl -s -o /dev/null -D - \
  "https://api.makanmasak.com/api/v1/customer/auth/oauth/line/start" | head -5
```

接著用瀏覽器實走一次：開 `/api/v1/customer/auth/oauth/line/start`，登入 LINE、
同意授權，應該會被導回 `https://makanmasak.com/login?oauth_code=...`。

拿到 `oauth_code` 之後，前端會用它換 session（`POST /auth/oauth/complete`）。
**前端目前還沒接這一段**，所以在前端完成之前，這一步只能驗到「導回來且帶著
code」為止。

### 2.8 LINE 專屬注意事項

- **PKCE**：LINE 只支援 `S256`，不支援 `plain`。我們的實作就是 S256，相符。
- **id_token 簽章**：LINE 用 ES256。我們的驗簽支援 RS256 與 ES256 兩種，相符。
- **Channel 有「開發中／已發布」狀態**：開發中的 Channel 只有被加入測試者名單的
  帳號能登入。要正式上線記得發布。

---

## 3. Google

### 3.1 建立 OAuth client

1. 進 [Google Cloud Console](https://console.cloud.google.com/)，選一個專案（或新建）
2. 左側 **APIs & Services** → **OAuth consent screen**，先把同意畫面設定完成：
   - **User Type** 選 **External**（除非你有 Google Workspace 且只給內部用）
   - 填 App name、User support email、Developer contact information
   - **Scopes** 加入 `openid`、`.../auth/userinfo.email`、`.../auth/userinfo.profile`
   - 未發布狀態下只有 **Test users** 名單裡的帳號能登入，正式上線前要按 **Publish app**
3. 左側 **APIs & Services** → **Credentials** → **+ Create Credentials** →
   **OAuth client ID**
4. **Application type** 選 **Web application**
5. **Authorized redirect URIs** → **+ Add URI**，加入：
   ```
   https://api.makanmasak.com/api/v1/customer/auth/oauth/google/callback
   http://localhost:8787/api/v1/customer/auth/oauth/google/callback
   ```
   （Google 要求 redirect URI 走 HTTPS，但 **localhost 是明文豁免**，所以本機那條
   用 `http://` 是可以的。）
6. 建立後會顯示 **Client ID** 與 **Client secret**

### 3.2 寫入設定

```bash
# 非機密：apps/api/wrangler.toml 的 [env.production.vars]
GOOGLE_OAUTH_CLIENT_ID = "xxxxx.apps.googleusercontent.com"

cd apps/api
pnpm wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env production
```

### 3.3 Google 專屬注意事項

- Google 會回 `email_verified`。我們只有在它為 `true` 時才會把該 email 認領成
  `primary_email`，避免未驗證的宣稱佔住別人的地址。
- 同意畫面若停在 **Testing** 狀態，未列入 test users 的顧客會看到「這個應用程式
  未經驗證」並被擋下。正式營運前務必 **Publish**。

---

## 4. Apple

Apple 是三家裡最麻煩的一家，而且**要付費**。若你短期內不打算上架 iOS App，可以
先跳過。

### 4.1 前置：付費會員資格

需要 **Apple Developer Program** 會員資格（年費 USD 99）。免費的 Apple ID
**無法**建立 Sign in with Apple 所需的 Services ID 與金鑰。

### 4.2 什麼時候是**強制**的

若你把 MakanMasak 上架成 iOS App，**而且**在 App 裡提供了其他第三方登入
（LINE、Google），Apple 的審查規定會要求你**必須**同時提供 Sign in with Apple。
純網頁則沒有這個強制。

### 4.3 建立 Services ID（這就是 `APPLE_CLIENT_ID`）

1. 進 [Apple Developer 帳號](https://developer.apple.com/account) →
   **Certificates, Identifiers & Profiles**
2. 側欄點 **Identifiers** → 左上角 **+**
3. 選 **Services ID** → **Continue**
4. 填 **Description** 與一個唯一的 **Identifier**（慣例用反向網域，例如
   `com.makanmasak.web`）—— **這個 identifier 就是 `APPLE_CLIENT_ID`**
5. 註冊後回到清單，點進剛建立的 Services ID
6. 勾選 **Sign in with Apple** → **Configure**
7. 在跳出的視窗：
   - **Primary App ID** 選擇你的 App ID
   - **Website URLs** 填入 **Domains and Subdomains** 與 **Return URLs**，兩者都用
     **逗號分隔**
     - Domain：`api.makanmasak.com`（**不要**加 `https://`，也不要結尾斜線，加了會
       報 Invalid domain）
     - Return URL：`https://api.makanmasak.com/api/v1/customer/auth/oauth/apple/callback`
       （這裡**要**帶 `https://`）
8. **Done** → **Continue** → **Save**

> Apple 官方文件目前寫明：登記 domains 與 subdomains **不需要**在伺服器上傳驗證
> 檔。若你實際操作時遇到 domain 驗證失敗，才需要處理
> `/.well-known/apple-developer-domain-association.txt`（那主要是 Sign in with
> Apple JS 網頁流程的需求，我們走的是伺服器端轉址流程）。

### 4.4 取得 Team ID

在 Apple Developer 帳號的 **Membership details** 頁面，**Team ID** 是一串 10 碼的
英數字。這就是 `APPLE_TEAM_ID`。

### 4.5 建立私鑰（`.p8`）與 Key ID

1. **Certificates, Identifiers & Profiles** → 側欄 **Keys** → **+**
2. 填 **Key Name**，勾選 **Sign in with Apple**，點該列的 **Configure** 選定
   Primary App ID
3. **Continue** → **Register**
4. 點 **Download**，會下載一個 `AuthKey_XXXXXXXXXX.p8` 檔

> **這個檔只能下載一次。** Apple 不會保存它，Download 按鈕按過就會變灰。下載後請
> 立刻存進密碼管理器；弄丟就只能作廢重建。

5. 該金鑰頁面上的 **Key ID**（檔名裡那 10 碼）就是 `APPLE_KEY_ID`

### 4.6 Apple 不接受 localhost

Return URL 必須是**真實網域**，不能是 `localhost`，也不能是 IP。本機開發若要測
Apple，唯一實務作法是在 `hosts` 檔把一個你擁有的網域指到 `127.0.0.1`，並在 Apple
主控台登記那個網域。

**建議：本機開發不要測 Apple**，用 LINE 或 Google 驗證流程即可 —— 三家共用同一段
身分解析程式碼，差別只在 provider 設定。

### 4.7 寫入設定

```bash
# 非機密：apps/api/wrangler.toml 的 [env.production.vars]
APPLE_CLIENT_ID = "com.makanmasak.web"
APPLE_TEAM_ID   = "ABCDE12345"
APPLE_KEY_ID    = "FGHIJ67890"

cd apps/api
# 貼上整個 .p8 檔的內容，含 -----BEGIN PRIVATE KEY----- 與 -----END----- 兩行
pnpm wrangler secret put APPLE_SIGN_IN_PRIVATE_KEY --env production
```

程式碼可以吃有無 PEM 標頭的兩種格式，換行是真換行或被 shell 轉義成 `\n` 都能處理
（`appleClientSecret.ts` 的 `pemToPkcs8`）。

### 4.8 Apple 專屬注意事項

- **client_secret 不是固定字串**。Apple 要求用 `.p8` 私鑰現簽一個 ES256 JWT。這件
  事程式碼已經自動處理並快取，你不需要手動產生任何東西 —— 只要把 `.p8` 內容放進
  secret 就好。
- **姓名與 email 只在第一次授權時回傳**，之後永遠拿不到。程式碼在第一次就會把它們
  存進 `provider_display_name` / `provider_email`。若你在測試時反覆授權同一個
  Apple ID 卻拿不到姓名，那是正常的 —— 要在 Apple ID 設定裡先移除對本 App 的授權
  才會重新回傳。
- **Private Relay 匿名信箱**（`xxx@privaterelay.appleid.com`）：程式碼刻意**不會**
  拿它去比對既有帳號，也不會當作可寄信地址。那是每個 App 一組的別名，代表不了任何
  人的身分。
- **Apple 的 callback 是 POST 不是 GET**（`response_mode=form_post`）。程式碼兩種
  動詞都接，你不需要另外設定，但如果你在中間放了任何只允許 GET 的 CDN 規則或 WAF
  規則，那條路會斷。

---

## 5. 完成後的整體驗證

```bash
# 這支端點會列出「這個部署實際上能用」的 provider，是最快的檢查
curl -s https://api.makanmasak.com/api/v1/customer/auth/oauth/providers
# 期望：{"success":true,"data":{"providers":["line","google","apple"]}}
```

三家各自實走一次瀏覽器流程，確認會導回 `https://makanmasak.com/...?oauth_code=...`。

驗證第一個真人帳號真的建立成功：

```bash
cd apps/api
pnpm wrangler d1 execute makanmasak-prod --remote --env production \
  --command "SELECT provider, COUNT(*) FROM customer_auth_identities GROUP BY provider"
```

---

## 6. 常見錯誤對照

| 症狀 | 原因 | 處理 |
| --- | --- | --- |
| `/providers` 回空陣列 | 該 provider 少了至少一個必要值 | 對照 §1.1 逐項確認；Apple 需要四個值都齊 |
| `503 OAUTH_PROVIDER_UNAVAILABLE` | 同上 | 同上 |
| provider 端顯示 redirect_uri 不符 | 主控台登記的字串與 `API_BASE_URL` 推導出來的不一致 | 逐字比對，注意結尾斜線與 http/https |
| `400 OAUTH_STATE_INVALID` | 授權流程超過 10 分鐘，或同一個 callback 被重放 | 重新從 `/start` 開始 |
| `id_token audience does not match` | client id 設錯（例如把 Apple 的 App ID 當成 Services ID） | Apple 的 `APPLE_CLIENT_ID` 必須是 **Services ID** |
| Google 顯示「應用程式未經驗證」 | 同意畫面還在 Testing | 加入 test users，或 Publish app |
| LINE 登入成功但拿不到 email | 未申請 email 權限 | 見 §2.5；不影響登入本身 |

---

## 7. 相關檔案

| 路徑 | 內容 |
| --- | --- |
| `apps/api/src/features/customer/services/oauth/providers.ts` | 三家的端點與設定完整性判定 |
| `apps/api/src/features/customer/services/oauth/appleClientSecret.ts` | Apple client secret 現簽 |
| `apps/api/src/features/customer/routes/oauth.ts` | 七條路由 |
| `docs/superpowers/specs/2026-08-30-customer-loyalty-and-oauth-design.md` | 設計決策與理由 |
