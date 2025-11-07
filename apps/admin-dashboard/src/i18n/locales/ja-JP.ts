import { Messages } from '../index'

/**
 * 日本語翻訳
 */
const jaJP: Messages = {
  // 共通語彙
  common: {
    save: '保存',
    cancel: 'キャンセル',
    confirm: '確認',
    delete: '削除',
    edit: '編集',
    add: '追加',
    search: '検索',
    filter: 'フィルター',
    export: 'エクスポート',
    import: 'インポート',
    refresh: '更新',
    loading: '読み込み中...',
    noData: 'データなし',
    submit: '送信',
    reset: 'リセット',
    back: '戻る',
    next: '次へ',
    previous: '前へ',
    close: '閉じる',
    view: '表示',
    download: 'ダウンロード',
    upload: 'アップロード',
    select: '選択',
    selectAll: 'すべて選択',
    deselectAll: 'すべて解除',
    actions: '操作',
    status: 'ステータス',
    createdAt: '作成日時',
    updatedAt: '更新日時',
    yes: 'はい',
    no: 'いいえ',
    fillRequired: '必須項目を入力してください'
  },

  // スケジュールシステム
  scheduling: {
    title: '従業員シフト',
    calendar: 'カレンダー表示',
    list: 'リスト表示',
    createSchedule: 'シフト作成',
    editSchedule: 'シフト編集',
    deleteSchedule: 'シフト削除',
    scheduleDetails: 'シフト詳細',

    filters: {
      searchEmployee: '従業員名を検索...',
      dateRange: '日付範囲',
      startDate: '開始日',
      endDate: '終了日',
      status: 'ステータス',
      allStatus: 'すべてのステータス',
      shift: 'シフト',
      allShifts: 'すべてのシフト'
    },

    columns: {
      date: '日付',
      weekday: '曜日',
      employee: '従業員',
      shift: 'シフト',
      startTime: '開始時刻',
      endTime: '終了時刻',
      hours: '時間数',
      status: 'ステータス',
      notes: '備考'
    },

    form: {
      selectEmployee: '従業員を選択',
      selectShift: 'シフトを選択',
      selectDate: '日付を選択',
      workDate: '勤務日',
      shiftTemplate: 'シフトテンプレート',
      notes: '備考',
      addNotes: '備考を追加...',
      repeatSchedule: 'シフトを繰り返す',
      repeatDays: '繰り返し日数',
      repeatUntil: '繰り返し終了日'
    },

    batch: {
      title: '一括操作',
      selected: '{count}件選択中',
      confirmAll: '一括確認',
      cancelAll: '一括キャンセル',
      deleteAll: '一括削除',
      exportSelected: '選択項目をエクスポート',
      confirmAction: '{count}件のシフトにこの操作を実行しますか？'
    },

    pagination: {
      showing: '{total}件中{start}-{end}件を表示',
      itemsPerPage: '件/ページ',
      firstPage: '最初',
      lastPage: '最後',
      previousPage: '前へ',
      nextPage: '次へ'
    },

    conflicts: {
      title: 'シフト競合',
      detected: '{count}件の競合を検出',
      noConflicts: '競合なし',
      overlapShift: 'シフト重複',
      exceedHours: '超過勤務',
      leaveConflict: '休暇競合',
      maxConsecutiveDays: '連続勤務日数超過',
      insufficientRest: '休息時間不足',
      resolve: '解決',
      ignore: '無視',
      details: '競合詳細'
    },

    stats: {
      totalSchedules: '総シフト数',
      totalHours: '総時間数',
      averageHours: '平均時間数',
      employeeCount: '従業員数',
      thisWeek: '今週',
      thisMonth: '今月',
      today: '今日'
    }
  },

  // シフトテンプレート
  shiftTemplates: {
    title: 'シフトテンプレート',
    create: 'テンプレート作成',
    edit: 'テンプレート編集',
    delete: 'テンプレート削除',
    duplicate: 'テンプレート複製',

    form: {
      name: 'テンプレート名',
      nameRequired: 'テンプレート名を入力してください',
      startTime: '開始時刻',
      endTime: '終了時刻',
      duration: '時間',
      hours: '{hours}時間',
      color: '色',
      description: '説明',
      isActive: 'このテンプレートを有効化'
    },

    usage: {
      title: '使用状況',
      timesUsed: '使用回数',
      lastUsed: '最終使用',
      never: '未使用'
    },

    colors: {
      blue: '青',
      green: '緑',
      orange: 'オレンジ',
      purple: '紫',
      red: '赤',
      pink: 'ピンク',
      cyan: 'シアン',
      gray: 'グレー'
    },

    presets: {
      morning: '朝',
      afternoon: '午後',
      evening: '夕方',
      night: '夜',
      fullDay: '終日'
    }
  },

  // シフト交換申請
  swapRequests: {
    title: 'シフト交換申請',
    create: 'シフト交換申請',
    approve: '承認',
    reject: '拒否',
    cancel: '申請キャンセル',

    status: {
      pending: '承認待ち',
      approved: '承認済み',
      rejected: '拒否済み',
      cancelled: 'キャンセル済み'
    },

    form: {
      requester: '申請者',
      target: '対象従業員',
      reason: '理由',
      reasonRequired: '理由を入力してください',
      originalShift: '現在のシフト',
      targetShift: '希望シフト',
      selectOriginal: '交換するシフトを選択',
      selectTarget: '相手のシフトを選択',
      noAvailableShifts: '利用可能なシフトがありません'
    },

    details: {
      requestedBy: '申請者',
      requestedAt: '申請日時',
      swapWith: '交換相手',
      reason: '理由',
      originalShiftDetails: '現在のシフト詳細',
      targetShiftDetails: '希望シフト詳細',
      approvedBy: '承認者',
      approvedAt: '承認日時',
      rejectedBy: '拒否者',
      rejectedAt: '拒否日時',
      rejectionReason: '拒否理由'
    },

    actions: {
      viewDetails: '詳細を表示',
      approveConfirm: 'このシフト交換申請を承認しますか？',
      rejectConfirm: 'このシフト交換申請を拒否しますか？',
      cancelConfirm: 'このシフト交換申請をキャンセルしますか？'
    }
  },

  status: {
    scheduled: 'スケジュール済み',
    confirmed: '確認済み',
    cancelled: 'キャンセル済み',
    completed: '完了',
    pending: '保留中',
    active: 'アクティブ',
    inactive: '非アクティブ'
  },

  weekdays: {
    short: {
      sunday: '日',
      monday: '月',
      tuesday: '火',
      wednesday: '水',
      thursday: '木',
      friday: '金',
      saturday: '土'
    },
    long: {
      sunday: '日曜日',
      monday: '月曜日',
      tuesday: '火曜日',
      wednesday: '水曜日',
      thursday: '木曜日',
      friday: '金曜日',
      saturday: '土曜日'
    }
  },

  errors: {
    generic: '操作に失敗しました。もう一度お試しください',
    networkError: 'ネットワークエラー。接続を確認してください',
    notFound: 'データが見つかりません',
    unauthorized: 'この操作を実行する権限がありません',
    validationError: 'データ検証に失敗しました',
    requiredField: 'この項目は必須です',
    invalidDate: '日付形式が無効です',
    invalidTime: '時刻形式が無効です',
    startTimeAfterEndTime: '開始時刻は終了時刻より前である必要があります',
    dateInPast: '過去の日付は指定できません',
    duplicateSchedule: 'この時間帯にはすでにシフトが存在します',
    loadFailed: '読み込みに失敗しました',
    saveFailed: '保存に失敗しました',
    deleteFailed: '削除に失敗しました'
  },

  success: {
    saved: '保存しました',
    deleted: '削除しました',
    created: '作成しました',
    updated: '更新しました',
    scheduled: 'スケジュールしました',
    cancelled: 'キャンセルしました',
    confirmed: '確認しました',
    approved: '承認しました',
    rejected: '拒否しました',
    exported: 'エクスポートしました',
    imported: 'インポートしました'
  },

  confirmations: {
    delete: '削除してもよろしいですか？',
    deleteSchedule: 'このシフトを削除してもよろしいですか？',
    deleteTemplate: 'このテンプレートを削除してもよろしいですか？',
    cancel: 'キャンセルしてもよろしいですか？',
    unsavedChanges: '未保存の変更があります。本当に離脱しますか？',
    batchDelete: '選択した{count}件を削除してもよろしいですか？'
  },

  // グラフコンポーネント
  charts: {
    workHours: {
      title: '総労働時間統計',
      customPeriod: 'カスタム期間',
      barChart: '棒グラフ',
      lineChart: '折れ線グラフ',
      totalHours: '総労働時間',
      averageHours: '平均労働時間',
      employeeCount: '従業員数',
      loadFailed: 'データの読み込みに失敗しました',
      top10: 'トップ10',
      hoursUnit: '時間'
    },
    shiftDistribution: {
      title: 'シフト分布統計',
      doughnutChart: 'ドーナツグラフ',
      pieChart: '円グラフ',
      distribution: 'シフト分布',
      people: '人',
      loadFailed: 'データの読み込みに失敗しました'
    },
    trend: {
      title: '労働時間トレンド分析',
      totalHours: '総労働時間',
      averageHours: '平均労働時間',
      scheduleCount: 'シフト数',
      last7Days: '過去7日間',
      last30Days: '過去30日間',
      last90Days: '過去90日間',
      currentValue: '現在値',
      trend: 'トレンド',
      changeRate: '変化率',
      upTrend: '上昇傾向',
      downTrend: '下降傾向',
      stable: '安定',
      items: '件',
      loadFailed: 'データの読み込みに失敗しました'
    }
  },

  // 予約システム
  reservation: {
    title: '予約管理',
    create: '新規予約',
    createSuccess: '予約が作成されました',
    createError: '予約の作成に失敗しました',
    loadError: '予約リストの読み込みに失敗しました',
    confirmPrompt: 'この予約を確認してもよろしいですか？',
    confirmError: '予約の確認に失敗しました',
    arrivedError: '到着マークに失敗しました',
    seatedError: '着席マークに失敗しました',
    cancelPrompt: 'この予約をキャンセルしてもよろしいですか？',
    cancelError: '予約のキャンセルに失敗しました',
    confirmationCode: '確認コード',
    customerName: '顧客名',
    customerPhone: '電話番号',
    customerEmail: 'メールアドレス',
    datetime: '予約時刻',
    selectDatetime: '予約時刻を選択',
    partySize: '人数',
    people: '名',
    duration: '所要時間',
    minutes: '分',
    specialRequests: '特別なリクエスト',
    specialRequestsPlaceholder: '例：ベビーチェア、車椅子対応、窓際の席など',
    notes: '備考',
    status: 'ステータス',
    detail: '予約詳細',
    stats: {
      total: '総予約数',
      pending: '確認待ち',
      confirmed: '確認済み',
      seated: '着席済み'
    },
    filter: {
      date: '日付',
      selectDate: '日付を選択',
      status: 'ステータス',
      allStatus: 'すべてのステータス',
      phone: '電話番号',
      enterPhone: '電話番号を入力'
    }
  },

  // 待機リストシステム
  waitingList: {
    title: '待機リスト管理',
    addCustomer: '待機リストに追加',
    addSuccess: '待機リストに追加されました',
    addError: '待機リストへの追加に失敗しました',
    loadError: '待機リストの読み込みに失敗しました',
    callCustomer: '顧客を呼び出す',
    callError: '呼び出しに失敗しました',
    confirmCall: '呼び出し確認',
    call: '呼び出す',
    callNext: '次を呼び出す',
    seat: '着席',
    expire: '期限切れ',
    cancel: 'キャンセル',
    seatedError: '着席マークに失敗しました',
    expirePrompt: '期限切れとしてマークしてもよろしいですか？',
    expireError: '期限切れマークに失敗しました',
    cancelPrompt: 'このエントリをキャンセルしてもよろしいですか？',
    cancelError: 'キャンセルに失敗しました',
    batchCallError: '一括呼び出しに失敗しました',
    customerName: '顧客名',
    customerPhone: '電話番号',
    partySize: '人数',
    people: '名',
    notes: '備考',
    notesPlaceholder: '例：ベビーカー、特別な要望など',
    queueNumber: '整理券番号',
    waitTime: '待ち時間',
    joinedAt: '参加時刻',
    estimatedWait: '推定待ち時間',
    partiesAhead: '前方待機組数',
    availableTables: '空き席数',
    assignTable: 'テーブル割り当て',
    selectTable: 'テーブルを選択',
    selectTableRequired: '割り当てるテーブルを選択してください',
    notificationMethod: '通知方法',
    sms: 'SMS',
    display: 'ディスプレイ',
    both: '両方',
    queue: '待機列',
    noQueue: '待機者なし',
    cardView: 'カード表示',
    tableView: 'テーブル表示',
    stats: {
      waiting: '待機中',
      called: '呼び出し済み',
      avgWait: '平均待ち時間',
      todayTotal: '本日の合計'
    },
    filter: {
      status: 'ステータス',
      allStatus: 'すべてのステータス',
      phone: '電話番号',
      enterPhone: '電話番号を入力'
    }
  },

  // ページタイトルとナビゲーション
  header: {
    title: 'MakanMakan 管理ダッシュボード',
    home: 'ホーム',
    realtime: {
      connected: 'リアルタイム接続中',
      disconnected: '接続が切断されました'
    },
    userMenu: {
      logout: 'ログアウト'
    },
    breadcrumb: {
      home: 'ホーム',
      orders: '注文管理',
      menu: 'メニュー管理',
      tables: 'テーブル管理',
      users: '従業員管理',
      analytics: 'データ分析'
    },
    roles: {
      admin: 'システム管理者',
      owner: 'オーナー',
      chef: 'シェフ',
      service: 'サーバー',
      cashier: 'レジ係'
    }
  }
}

export default jaJP
