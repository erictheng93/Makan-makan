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

  // 系統監控
  monitoring: {
    title: '系統監控',
    subtitle: '即時監控系統健康狀態、性能指標與警報',

    // 按鈕與操作
    actions: {
      refresh: '立即更新',
      refreshing: '更新中...',
      autoRefresh: '自動更新',
      manualRefresh: '手動更新',
      createAlertRule: '新增警報規則',
      testAlert: '測試警報',
      resetMetrics: '重置指標',
      exportReport: '匯出報告'
    },

    // 健康狀態
    health: {
      overall: '整體健康狀態',
      score: '健康分數',
      uptime: '系統運行時間',
      lastUpdate: '最後更新',
      status: {
        healthy: '健康',
        warning: '警告',
        critical: '嚴重',
        down: '離線'
      }
    },

    // 關鍵指標
    keyMetrics: {
      title: '關鍵指標',
      requestsPerMinute: '每分鐘請求數',
      averageResponseTime: '平均響應時間',
      cacheHitRate: '快取命中率',
      activeErrors: '活動錯誤'
    },

    // 組件狀態
    components: {
      title: '系統組件狀態',
      api: 'API 服務',
      database: '資料庫',
      cache: '快取服務',
      external: '外部服務',
      status: '狀態',
      latency: '延遲',
      healthy: '正常',
      issues: '問題'
    },

    // 標籤頁
    tabs: {
      alerts: '警報規則',
      performance: '性能報告',
      errors: '錯誤分析'
    },

    // 警報規則
    alerts: {
      title: '警報規則',
      noAlerts: '暫無警報規則',
      createFirst: '建立第一個警報規則來監控系統狀態',
      rule: {
        name: '規則名稱',
        type: '警報類型',
        severity: '嚴重程度',
        threshold: '閾值',
        enabled: '啟用',
        disabled: '停用',
        lastTriggered: '最後觸發',
        actions: '操作'
      },
      severity: {
        info: '資訊',
        warning: '警告',
        critical: '嚴重',
        fatal: '致命'
      },
      actions: {
        enable: '啟用',
        disable: '停用',
        edit: '編輯',
        delete: '刪除',
        test: '測試'
      },
      messages: {
        enabled: '警報規則已啟用',
        disabled: '警報規則已停用',
        deleted: '警報規則已刪除',
        deleteConfirm: '確定要刪除這個警報規則嗎？'
      }
    },

    // 性能報告
    performance: {
      title: '性能報告',
      selectPeriod: '選擇時間範圍',
      last1Day: '最近 1 天',
      last7Days: '最近 7 天',
      last30Days: '最近 30 天',

      api: {
        title: 'API 性能',
        totalRequests: '總請求數',
        averageResponseTime: '平均響應時間',
        p95ResponseTime: 'P95 響應時間',
        errorRate: '錯誤率'
      },

      database: {
        title: '資料庫性能',
        totalQueries: '總查詢數',
        averageQueryTime: '平均查詢時間',
        slowQueries: '慢查詢數',
        queryErrorRate: '查詢錯誤率'
      },

      cache: {
        title: '快取性能',
        hitRate: '命中率',
        totalKeys: '快取鍵總數',
        totalSize: '快取大小',
        expiringKeys: '即將過期'
      },

      charts: {
        trendComparison: '性能趨勢對比（最近24小時）',
        cacheHitRate: '快取命中率趨勢（最近24小時）',
        apiResponseTime: 'API 響應時間',
        dbQueryTime: '資料庫查詢時間'
      },

      recommendations: {
        title: '優化建議',
        loading: '載入性能報告中...'
      }
    },

    // 錯誤分析
    errors: {
      title: '錯誤分析',
      statistics: '錯誤類型統計',
      details: '錯誤詳情',
      noErrors: '暫無錯誤記錄',
      systemRunningNormally: '系統運行正常',
      occurredTimes: '發生次數',
      errorCount: '錯誤次數'
    },

    // 即時警報
    realtime: {
      title: '即時警報',
      connectionStatus: {
        connected: '已連接到警報系統',
        reconnecting: '重新連接中',
        disconnected: '未連接',
        reconnect: '重新連接'
      },
      noAlerts: '沒有警報',
      systemNormal: '系統運行正常',
      soundEnabled: '關閉聲音',
      soundDisabled: '開啟聲音',
      clearAll: '清除全部',
      acknowledged: '已確認',
      currentValue: '當前值',
      threshold: '閾值',
      justNow: '剛才',
      minutesAgo: '{count} 分鐘前',
      hoursAgo: '{count} 小時前'
    },

    // 通知訊息
    notifications: {
      dataUpdated: '監控數據已更新',
      updateFailed: '更新監控數據失敗',
      alertAcknowledged: '警報已確認',
      alertsCleared: '已清除所有警報',
      reconnecting: '重新連接中...',
      connectionFailed: '無法連接到警報系統',
      loadingFailed: '載入監控數據失敗',
      performanceReportFailed: '載入性能報告失敗',
      autoRefreshEnabled: '已啟用自動更新',
      autoRefreshDisabled: '已停用自動更新'
    },

    // 進階篩選器
    filters: {
      title: '高級篩選',
      quickFilters: '快速篩選',
      savedFilters: '保存的篩選器',
      customFilter: '自定義篩選',
      keyword: '關鍵字搜索',
      keywordPlaceholder: '搜索警報訊息、組件名稱或 ID...',
      timeRange: '時間範圍',
      componentType: '組件類型',
      severityLevel: '嚴重程度',
      alertStatus: '警報狀態',
      advancedOptions: '高級選項',
      showAdvanced: '顯示高級選項',
      hideAdvanced: '隱藏高級選項',
      minResponseTime: '最小響應時間 (ms)',
      maxResponseTime: '最大響應時間 (ms)',
      minErrorRate: '最小錯誤率',
      maxErrorRate: '最大錯誤率',
      includeResolved: '包含已解決的警報',
      includeMuted: '包含已靜音的警報',
      groupByComponent: '按組件分組',
      apply: '應用篩選',
      reset: '重置篩選',
      save: '保存篩選器',
      saveFilter: '保存篩選器',
      filterName: '篩選器名稱',
      filterNamePlaceholder: '例如：嚴重 API 錯誤',
      filterDescription: '描述（可選）',
      filterDescriptionPlaceholder: '說明此篩選器的用途...',
      activeFilters: '活動篩選',
      activeFiltersCount: '{count} 個活動篩選',
      noFilters: '無篩選條件',
      presets: {
        criticalAlerts: '嚴重警報',
        apiIssues: 'API 問題',
        databasePerformance: '數據庫性能',
        recentErrors: '近期錯誤',
        allComponents: '全部組件',
        allSeverity: '全部級別',
        allStatus: '全部狀態'
      },
      validation: {
        invalidTimeRange: '無效的時間範圍',
        invalidResponseTime: '響應時間範圍無效',
        nameRequired: '請輸入篩選器名稱',
        filterSaved: '篩選器已保存',
        filterDeleted: '篩選器已刪除'
      }
    },

    // 導出報告
    export: {
      title: '導出報告',
      exportReport: '導出報告',
      exporting: '導出中...',
      exportSuccess: '導出成功',
      exportFailed: '導出失敗',
      format: '導出格式',
      dataType: '數據類型',
      timeRange: '時間範圍',
      startDate: '開始日期',
      endDate: '結束日期',
      options: '導出選項',
      includeSummary: '包含摘要統計',
      includeDetails: '包含詳細數據',
      includeCharts: '包含圖表',
      pdfOptions: 'PDF 選項',
      orientation: '方向',
      portrait: '直向',
      landscape: '橫向',
      pageSize: '頁面大小',
      includePageNumbers: '包含頁碼',
      csvOptions: 'CSV 選項',
      delimiter: '分隔符',
      includeHeaders: '包含標題行',
      quickTemplates: '快速範本',
      customOptions: '自定義選項',
      preview: '導出預覽',
      recordCount: '記錄數',
      estimatedSize: '估計大小',
      cancel: '取消',
      export: '導出',
      formats: {
        csv: 'CSV (逗號分隔值)',
        excel: 'Excel (xlsx)',
        pdf: 'PDF (可攜式文件)'
      },
      dataTypes: {
        alerts: '警報記錄',
        performance: '性能指標',
        errors: '錯誤日誌',
        health: '健康狀態',
        all: '完整數據'
      },
      templates: {
        dailySummary: '每日摘要報告',
        dailySummaryDesc: '包含過去24小時的健康狀態、性能指標和警報摘要',
        weeklyPerformance: '週度性能報告',
        weeklyPerformanceDesc: '過去7天的詳細性能指標和趨勢分析',
        alertHistory: '警報歷史記錄',
        alertHistoryDesc: '警報的完整歷史記錄，適合數據分析',
        errorAnalysis: '錯誤分析報告',
        errorAnalysisDesc: '錯誤日誌的詳細分析和統計',
        executiveSummary: '管理層摘要',
        executiveSummaryDesc: '高層次的系統健康狀態和關鍵指標概覽'
      }
    },

    // 自定義佈局
    layout: {
      title: '儀表板佈局',
      editMode: '編輯模式',
      exitEditMode: '退出編輯',
      editLayout: '編輯佈局',
      saveLayout: '保存佈局',
      cancelEdit: '取消編輯',
      addWidget: '新增小部件',
      removeWidget: '移除小部件',
      configureWidget: '配置小部件',
      lockWidget: '鎖定小部件',
      unlockWidget: '解鎖小部件',
      widgetLocked: '已鎖定',
      widgetUnlocked: '已解鎖',
      selectWidget: '選擇小部件',
      selectPreset: '選擇預設佈局',
      loadPreset: '載入預設',
      customLayout: '自定義佈局',
      layoutName: '佈局名稱',
      layoutDescription: '佈局描述',
      defaultLayout: '默認佈局',
      currentLayout: '當前佈局',
      noWidgets: '還沒有小部件',
      noWidgetsDesc: '點擊「新增小部件」來開始自定義您的儀表板',
      widgetCount: '{count} 個小部件',
      gridColumns: '網格列數',
      gridSize: '網格大小',
      widgets: {
        healthOverview: '健康狀態總覽',
        keyMetrics: '關鍵指標',
        componentStatus: '組件狀態',
        activeAlerts: '活動警報',
        performanceChart: '性能圖表',
        errorLog: '錯誤日誌',
        realtimeConnections: '即時連接',
        responseTimeChart: '響應時間圖表',
        throughputChart: '吞吐量圖表',
        cacheMetrics: '緩存指標',
        databaseMetrics: '數據庫指標',
        customChart: '自定義圖表'
      },
      categories: {
        overview: '總覽',
        performance: '性能',
        alerts: '警報',
        metrics: '指標',
        charts: '圖表'
      },
      presets: {
        defaultOverview: '默認總覽',
        defaultOverviewDesc: '平衡的總覽佈局，包含所有關鍵信息',
        performanceFocused: '性能專注',
        performanceFocusedDesc: '專注於性能指標和圖表的佈局',
        alertsMonitoring: '警報監控',
        alertsMonitoringDesc: '專注於警報和錯誤監控的佈局',
        minimal: '極簡佈局',
        minimalDesc: '簡潔的佈局，只顯示最關鍵的信息'
      },
      sizes: {
        small: '小',
        medium: '中',
        large: '大',
        xlarge: '特大'
      },
      actions: {
        saved: '佈局已保存',
        deleted: '佈局已刪除',
        loaded: '佈局已載入',
        resetToDefault: '重置為默認佈局',
        confirmDelete: '確定要刪除此佈局嗎？'
      }
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
