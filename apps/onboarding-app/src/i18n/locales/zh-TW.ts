import type { Messages } from "../types";

const zhTW: Messages = {
  common: {
    back: "返回",
    cancel: "取消",
    submit: "提交",
    loading: "載入中...",
    toast: {
      copiedToClipboard: "已複製到剪貼簿",
    },
  },

  app: {
    tagline: {
      selfHosted: "獨立部署",
    },
    footer: {
      copyright: "© 2024 MakanMakan. All rights reserved.",
    },
  },

  home: {
    hero: {
      titleLine1: "為您的餐廳打造",
      titleLine2: "專屬管理系統",
      subtitle: "獨立部署 · 數據安全 · 24 小時內完成上線",
      ctaApply: "立即申請",
      ctaDemo: "查看演示 →",
    },
    features: {
      isolated: {
        title: "獨立環境",
        description: "完全隔離的雲端環境，數據 100% 歸您所有",
      },
      secure: {
        title: "安全可靠",
        description: "基於 Cloudflare 全球邊緣網絡，企業級安全防護",
      },
      fast: {
        title: "快速部署",
        description: "自動化部署流程，最快 24 小時內完成上線",
      },
    },
    cta: {
      title: "準備好開始了嗎？",
      subtitle: "填寫申請表單，我們將在 24 小時內與您聯繫",
      button: "開始申請",
    },
  },

  apply: {
    title: "填寫申請資料",
    form: {
      businessName: {
        label: "餐廳名稱",
        placeholder: "例如：御膳房",
      },
      contactName: {
        label: "聯絡人姓名",
        placeholder: "您的姓名",
      },
      contactEmail: {
        label: "Email",
        placeholder: "your@email.com",
      },
      contactPhone: {
        label: "聯絡電話",
        placeholder: "02-1234-5678",
      },
      location: {
        label: "餐廳位置",
        help: "用於夜市 / 商圈探索與附近搜尋。請使用店面或攤位的實際座標。",
        useCurrent: "使用目前位置",
        locating: "定位中...",
        unsupported: "此瀏覽器不支援定位功能，請手動輸入座標",
        failure: "無法取得目前位置，請確認定位權限或手動輸入座標",
        latitudePlaceholder: "緯度，例如 24.147736",
        longitudePlaceholder: "經度，例如 120.673648",
      },
      subdomain: {
        label: "期望的網址 (選填)",
        placeholder: "yourrestaurant",
        available: "此網址可以使用",
        taken: "此網址已被使用",
        invalidFormat: "只能包含小寫字母、數字和連字符",
        emptyHint: "留空將自動生成",
        suggestionsLabel: "建議的替代網址：",
      },
      submitting: "提交中...",
      next: "下一步",
    },
    validation: {
      businessNameRequired: "請輸入餐廳名稱",
      contactNameRequired: "請輸入聯絡人姓名",
      emailRequired: "請輸入 Email",
      emailInvalid: "請輸入有效的 Email",
      phoneRequired: "請輸入聯絡電話",
      latitudeRequired: "請輸入餐廳緯度",
      latitudeInvalid: "緯度需介於 -90 到 90 之間",
      longitudeRequired: "請輸入餐廳經度",
      longitudeInvalid: "經度需介於 -180 到 180 之間",
      subdomainInvalidFormat: "只能包含小寫字母、數字和連字符",
      subdomainTooShort: "至少需要 3 個字元",
      subdomainTaken: "此網址已被使用",
    },
    toast: {
      submitSuccess: "申請資料已提交",
      submitFailureFallback: "提交失敗，請稍後再試",
    },
  },

  connect: {
    title: "連接 Cloudflare 帳號",
    assignedSubdomainLabel: "您的專屬網址：",
    info: {
      title: "為什麼需要 Cloudflare 帳號？",
      description:
        "MakanMakan 獨立部署使用您自己的 Cloudflare 帳號來運行，這確保您對所有資料擁有完整控制權。資源費用已包含在訂閱費中。",
    },
    steps: {
      heading: "操作步驟：",
      step1Prefix: "前往",
      step1Suffix: "（如果沒有帳號，請先註冊）",
      step2: "點擊右上角的頭像 → 選擇「My Profile」",
      step3Prefix: "複製您的",
      step3ClipboardText: "Account ID 位於 Dashboard 右側欄",
      step4: "前往「API Tokens」→ 點擊「Create Token」",
      step5: "選擇「Edit Cloudflare Workers」模板",
      step6: "複製生成的 API Token",
    },
    form: {
      accountId: {
        label: "Cloudflare Account ID",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      apiToken: {
        label: "API Token",
        placeholder: "••••••••••••••••••••••••••••••••",
      },
    },
    permissions: {
      titleSuccess: "權限檢查通過",
      titleWarning: "權限檢查結果",
      pagesOptional: "Pages (選用)",
    },
    verifiedMessage: "Cloudflare 帳號已成功連接！",
    button: {
      verifying: "驗證中...",
      verify: "驗證連接",
      completing: "處理中...",
      complete: "完成申請",
    },
    help: {
      prompt: "需要協助？",
      linkText: "聯繫我們安排視訊輔導",
    },
    validation: {
      accountIdRequired: "請輸入 Account ID",
      accountIdLength: "Account ID 應為 32 位字元",
      apiTokenRequired: "請輸入 API Token",
      apiTokenFormat: "API Token 格式不正確",
    },
    toast: {
      verifySuccess: "Cloudflare 帳號驗證成功！",
      verifyFailureFallback: "驗證失敗，請檢查您的資訊",
      completeSuccess: "申請已完成！",
      completeFailureFallback: "完成申請失敗，請稍後再試",
    },
  },

  success: {
    title: "申請已完成！",
    subtitleLine1: "恭喜您！您的 MakanMakan 獨立部署已建立完成。",
    subtitleLine2: "系統正在為您準備專屬環境。",
    summary: {
      title: "申請摘要",
      applicationId: "申請編號",
      tenantId: "租戶編號",
      businessName: "餐廳名稱",
      contactEmail: "聯絡 Email",
      plan: "選擇方案",
      subdomain: "專屬網址",
      cloudflare: "Cloudflare 帳號",
      connected: "已連接 ✓",
    },
    nextSteps: {
      title: "接下來會發生什麼？",
      email: {
        title: "確認郵件",
        prefix: "我們已發送確認郵件至",
        suffix: "，請查收。",
      },
      deploy: {
        title: "系統部署",
        description:
          "您的專屬系統正在部署中，通常在幾分鐘內完成。完成後會發送登入資訊。",
      },
      start: {
        title: "開始使用",
        description: "收到登入資訊後，您可以立即登入管理後台開始設定您的餐廳。",
      },
    },
    button: {
      goToAdmin: "前往管理後台",
      backHome: "返回首頁",
    },
    contact: {
      prompt: "有任何問題？請聯繫",
    },
  },

  plans: {
    standard: "標準版",
    professional: "專業版",
    enterprise: "企業版",
  },
};

export default zhTW;
