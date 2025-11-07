import { Messages } from '../index'

/**
 * 繁體中文
 */
const zhTW: Messages = {
  // 通用詞彙
  common: {
    save: '儲存',
    cancel: '取消',
    confirm: '確認',
    delete: '刪除',
    edit: '編輯',
    add: '新增',
    search: '搜尋',
    filter: '篩選',
    export: '匯出',
    import: '匯入',
    refresh: '重新整理',
    loading: '載入中...',
    noData: '暫無資料',
    submit: '送出',
    reset: '重置',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    close: '關閉',
    view: '檢視',
    download: '下載',
    upload: '上傳',
    select: '選擇',
    selectAll: '全選',
    deselectAll: '取消全選',
    actions: '操作',
    status: '狀態',
    createdAt: '建立時間',
    updatedAt: '更新時間',
    yes: '是',
    no: '否',
    fillRequired: '請填寫必填欄位'
  },

  // 排班系統
  scheduling: {
    title: '員工排班',
    calendar: '行事曆檢視',
    list: '列表檢視',
    createSchedule: '建立排班',
    editSchedule: '編輯排班',
    deleteSchedule: '刪除排班',
    scheduleDetails: '排班詳情',

    // 篩選條件
    filters: {
      searchEmployee: '搜尋員工姓名...',
      dateRange: '日期範圍',
      startDate: '開始日期',
      endDate: '結束日期',
      status: '狀態',
      allStatus: '全部狀態',
      shift: '班次',
      allShifts: '全部班次'
    },

    // 表格欄位
    columns: {
      date: '日期',
      weekday: '星期',
      employee: '員工',
      shift: '班次',
      startTime: '開始時間',
      endTime: '結束時間',
      hours: '時數',
      status: '狀態',
      notes: '備註'
    },

    // 表單欄位
    form: {
      selectEmployee: '選擇員工',
      selectShift: '選擇班次',
      selectDate: '選擇日期',
      workDate: '工作日期',
      shiftTemplate: '班次範本',
      notes: '備註',
      addNotes: '新增備註...',
      repeatSchedule: '重複排班',
      repeatDays: '重複天數',
      repeatUntil: '重複至'
    },

    // 批次操作
    batch: {
      title: '批次操作',
      selected: '已選擇 {count} 項',
      confirmAll: '批次確認',
      cancelAll: '批次取消',
      deleteAll: '批次刪除',
      exportSelected: '匯出選取',
      confirmAction: '確定要對 {count} 個排班執行此操作嗎？'
    },

    // 分頁
    pagination: {
      showing: '顯示 {start}-{end} 共 {total} 項',
      itemsPerPage: '每頁',
      firstPage: '首頁',
      lastPage: '末頁',
      previousPage: '上一頁',
      nextPage: '下一頁'
    },

    // 衝突檢測
    conflicts: {
      title: '排班衝突',
      detected: '偵測到 {count} 個衝突',
      noConflicts: '未發現衝突',
      overlapShift: '班次重疊',
      exceedHours: '超時加班',
      leaveConflict: '請假衝突',
      maxConsecutiveDays: '連續工作天數超限',
      insufficientRest: '休息時數不足',
      resolve: '解決衝突',
      ignore: '忽略',
      details: '衝突詳情'
    },

    // 統計資訊
    stats: {
      totalSchedules: '總排班數',
      totalHours: '總時數',
      averageHours: '平均時數',
      employeeCount: '員工數',
      thisWeek: '本週',
      thisMonth: '本月',
      today: '今天'
    }
  },

  // 班次範本
  shiftTemplates: {
    title: '班次範本',
    create: '建立範本',
    edit: '編輯範本',
    delete: '刪除範本',
    duplicate: '複製範本',

    form: {
      name: '範本名稱',
      nameRequired: '請輸入範本名稱',
      startTime: '開始時間',
      endTime: '結束時間',
      duration: '時長',
      hours: '{hours} 小時',
      color: '顏色',
      description: '描述',
      isActive: '啟用此範本'
    },

    usage: {
      title: '使用情況',
      timesUsed: '使用次數',
      lastUsed: '最後使用',
      never: '從未使用'
    },

    colors: {
      blue: '藍色',
      green: '綠色',
      orange: '橙色',
      purple: '紫色',
      red: '紅色',
      pink: '粉紅色',
      cyan: '青色',
      gray: '灰色'
    },

    presets: {
      morning: '早班',
      afternoon: '午班',
      evening: '晚班',
      night: '夜班',
      fullDay: '全天'
    }
  },

  // 換班申請
  swapRequests: {
    title: '換班申請',
    create: '申請換班',
    approve: '批准',
    reject: '拒絕',
    cancel: '取消申請',

    status: {
      pending: '待審核',
      approved: '已批准',
      rejected: '已拒絕',
      cancelled: '已取消'
    },

    form: {
      requester: '申請人',
      target: '目標員工',
      reason: '換班原因',
      reasonRequired: '請輸入換班原因',
      originalShift: '原班次',
      targetShift: '目標班次',
      selectOriginal: '選擇要換的班次',
      selectTarget: '選擇目標班次',
      noAvailableShifts: '暫無可用班次'
    },

    details: {
      requestedBy: '申請人',
      requestedAt: '申請時間',
      swapWith: '換班對象',
      reason: '換班原因',
      originalShiftDetails: '原班次詳情',
      targetShiftDetails: '目標班次詳情',
      approvedBy: '批准人',
      approvedAt: '批准時間',
      rejectedBy: '拒絕人',
      rejectedAt: '拒絕時間',
      rejectionReason: '拒絕原因'
    },

    actions: {
      viewDetails: '檢視詳情',
      approveConfirm: '確定要批准這個換班申請嗎？',
      rejectConfirm: '確定要拒絕這個換班申請嗎？',
      cancelConfirm: '確定要取消這個換班申請嗎？'
    }
  },

  // 狀態類型
  status: {
    scheduled: '已排班',
    confirmed: '已確認',
    cancelled: '已取消',
    completed: '已完成',
    pending: '待處理',
    active: '活躍',
    inactive: '未啟用'
  },

  // 星期
  weekdays: {
    short: {
      sunday: '週日',
      monday: '週一',
      tuesday: '週二',
      wednesday: '週三',
      thursday: '週四',
      friday: '週五',
      saturday: '週六'
    },
    long: {
      sunday: '星期日',
      monday: '星期一',
      tuesday: '星期二',
      wednesday: '星期三',
      thursday: '星期四',
      friday: '星期五',
      saturday: '星期六'
    }
  },

  // 錯誤訊息
  errors: {
    generic: '操作失敗，請重試',
    networkError: '網路錯誤，請檢查網路連線',
    notFound: '未找到資料',
    unauthorized: '您沒有權限執行此操作',
    validationError: '資料驗證失敗',
    requiredField: '此欄位為必填項',
    invalidDate: '日期格式無效',
    invalidTime: '時間格式無效',
    startTimeAfterEndTime: '開始時間必須早於結束時間',
    dateInPast: '日期不能是過去時間',
    duplicateSchedule: '此時間段已存在排班',
    loadFailed: '載入失敗',
    saveFailed: '儲存失敗',
    deleteFailed: '刪除失敗'
  },

  // 成功訊息
  success: {
    saved: '儲存成功',
    deleted: '刪除成功',
    created: '建立成功',
    updated: '更新成功',
    scheduled: '排班成功',
    cancelled: '取消成功',
    confirmed: '確認成功',
    approved: '批准成功',
    rejected: '拒絕成功',
    exported: '匯出成功',
    imported: '匯入成功'
  },

  // 確認對話框
  confirmations: {
    delete: '確定要刪除嗎？',
    deleteSchedule: '確定要刪除這個排班嗎？',
    deleteTemplate: '確定要刪除這個範本嗎？',
    cancel: '確定要取消嗎？',
    unsavedChanges: '有未儲存的變更，確定要離開嗎？',
    batchDelete: '確定要刪除選中的 {count} 項嗎？'
  },

  // 圖表組件
  charts: {
    workHours: {
      title: '總工時統計',
      customPeriod: '自訂期間',
      barChart: '柱狀圖',
      lineChart: '折線圖',
      totalHours: '總工時',
      averageHours: '平均工時',
      employeeCount: '員工數',
      loadFailed: '載入數據失敗',
      top10: '前10名',
      hoursUnit: 'h'
    },
    shiftDistribution: {
      title: '班別分布統計',
      doughnutChart: '環形圖',
      pieChart: '圓餅圖',
      distribution: '班別分布',
      people: '人',
      loadFailed: '載入數據失敗'
    },
    trend: {
      title: '工時趨勢分析',
      totalHours: '總工時',
      averageHours: '平均工時',
      scheduleCount: '排班數量',
      last7Days: '最近 7 天',
      last30Days: '最近 30 天',
      last90Days: '最近 90 天',
      currentValue: '當前值',
      trend: '趨勢',
      changeRate: '變化率',
      upTrend: '上升趨勢',
      downTrend: '下降趨勢',
      stable: '持平',
      items: '個',
      loadFailed: '載入數據失敗'
    }
  },

  // 訂位系統
  reservation: {
    title: '訂位管理',
    create: '新增訂位',
    createSuccess: '訂位建立成功',
    createError: '訂位建立失敗',
    loadError: '載入訂位列表失敗',
    confirmPrompt: '確定要確認此訂位嗎？',
    confirmError: '確認訂位失敗',
    arrivedError: '標記到店失敗',
    seatedError: '標記入座失敗',
    cancelPrompt: '確定要取消此訂位�as？',
    cancelError: '取消訂位失敗',
    confirmationCode: '確認碼',
    customerName: '顧客姓名',
    customerPhone: '聯絡電話',
    customerEmail: '電子郵件',
    datetime: '訂位時間',
    selectDatetime: '選擇訂位時間',
    partySize: '用餐人數',
    people: '人',
    duration: '用餐時長',
    minutes: '分鐘',
    specialRequests: '特殊需求',
    specialRequestsPlaceholder: '例如：兒童座椅、輪椅通道、靠窗座位等',
    notes: '備註',
    status: '狀態',
    detail: '訂位詳情',
    stats: {
      total: '總訂位數',
      pending: '待確認',
      confirmed: '已確認',
      seated: '已入座'
    },
    filter: {
      date: '日期',
      selectDate: '選擇日期',
      status: '狀態',
      allStatus: '全部狀態',
      phone: '手機號碼',
      enterPhone: '請輸入手機號碼'
    }
  },

  // 候位系統
  waitingList: {
    title: '候位管理',
    addCustomer: '新增候位',
    addSuccess: '加入候位成功',
    addError: '加入候位失敗',
    loadError: '載入候位列表失敗',
    callCustomer: '叫號',
    callError: '叫號失敗',
    confirmCall: '確認叫號',
    call: '叫號',
    callNext: '叫下一位',
    seat: '入座',
    expire: '過號',
    cancel: '取消',
    seatedError: '標記入座失敗',
    expirePrompt: '確定要標記為過號嗎？',
    expireError: '標記過號失敗',
    cancelPrompt: '確定要取消此候位嗎？',
    cancelError: '取消候位失敗',
    batchCallError: '批次叫號失敗',
    customerName: '顧客姓名',
    customerPhone: '聯絡電話',
    partySize: '用餐人數',
    people: '人',
    notes: '備註',
    notesPlaceholder: '例如：嬰兒車、特殊需求等',
    queueNumber: '號碼牌',
    waitTime: '等待時間',
    joinedAt: '加入時間',
    estimatedWait: '預估等待時間',
    partiesAhead: '前方等候組數',
    availableTables: '可用桌位數',
    assignTable: '分配桌位',
    selectTable: '請選擇桌位',
    selectTableRequired: '請選擇要分配的桌位',
    notificationMethod: '通知方式',
    sms: '簡訊',
    display: '螢幕顯示',
    both: '兩者皆是',
    queue: '候位隊列',
    noQueue: '目前沒有候位',
    cardView: '卡片檢視',
    tableView: '表格檢視',
    stats: {
      waiting: '等待中',
      called: '已叫號',
      avgWait: '平均等待',
      todayTotal: '今日總數'
    },
    filter: {
      status: '狀態',
      allStatus: '全部狀態',
      phone: '手機號碼',
      enterPhone: '請輸入手機號碼'
    }
  },

  // 頁面標題與導航
  header: {
    title: 'MakanMakan 管理後台',
    home: '首頁',
    realtime: {
      connected: '即時連線',
      disconnected: '連線中斷'
    },
    userMenu: {
      logout: '登出'
    },
    breadcrumb: {
      home: '首頁',
      orders: '訂單管理',
      menu: '菜單管理',
      tables: '桌台管理',
      users: '員工管理',
      analytics: '數據分析'
    },
    roles: {
      admin: '系統管理員',
      owner: '店主',
      chef: '廚師',
      service: '服務員',
      cashier: '收銀員'
    }
  }
}

export default zhTW
