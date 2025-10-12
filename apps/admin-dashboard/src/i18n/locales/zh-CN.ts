import { Messages } from '../index'

/**
 * 简体中文
 */
const zhCN: Messages = {
  // 通用词汇
  common: {
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    search: '搜索',
    filter: '筛选',
    export: '导出',
    import: '导入',
    refresh: '刷新',
    loading: '加载中...',
    noData: '暂无数据',
    submit: '提交',
    reset: '重置',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    close: '关闭',
    view: '查看',
    download: '下载',
    upload: '上传',
    select: '选择',
    selectAll: '全选',
    deselectAll: '取消全选',
    actions: '操作',
    status: '状态',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    yes: '是',
    no: '否'
  },

  // 排班系统
  scheduling: {
    title: '员工排班',
    calendar: '日历视图',
    list: '列表视图',
    createSchedule: '创建排班',
    editSchedule: '编辑排班',
    deleteSchedule: '删除排班',
    scheduleDetails: '排班详情',

    filters: {
      searchEmployee: '搜索员工姓名...',
      dateRange: '日期范围',
      startDate: '开始日期',
      endDate: '结束日期',
      status: '状态',
      allStatus: '全部状态',
      shift: '班次',
      allShifts: '全部班次'
    },

    columns: {
      date: '日期',
      weekday: '星期',
      employee: '员工',
      shift: '班次',
      startTime: '开始时间',
      endTime: '结束时间',
      hours: '时长',
      status: '状态',
      notes: '备注'
    },

    form: {
      selectEmployee: '选择员工',
      selectShift: '选择班次',
      selectDate: '选择日期',
      workDate: '工作日期',
      shiftTemplate: '班次模板',
      notes: '备注',
      addNotes: '添加备注...',
      repeatSchedule: '重复排班',
      repeatDays: '重复天数',
      repeatUntil: '重复至'
    },

    batch: {
      title: '批量操作',
      selected: '已选择 {count} 项',
      confirmAll: '批量确认',
      cancelAll: '批量取消',
      deleteAll: '批量删除',
      exportSelected: '导出选中',
      confirmAction: '确定要对 {count} 个排班执行此操作吗？'
    },

    pagination: {
      showing: '显示 {start}-{end} 共 {total} 项',
      itemsPerPage: '每页',
      firstPage: '首页',
      lastPage: '末页',
      previousPage: '上一页',
      nextPage: '下一页'
    },

    conflicts: {
      title: '排班冲突',
      detected: '检测到 {count} 个冲突',
      noConflicts: '未发现冲突',
      overlapShift: '班次重叠',
      exceedHours: '超时加班',
      leaveConflict: '请假冲突',
      maxConsecutiveDays: '连续工作天数超限',
      insufficientRest: '休息时间不足',
      resolve: '解决冲突',
      ignore: '忽略',
      details: '冲突详情'
    },

    stats: {
      totalSchedules: '总排班数',
      totalHours: '总时长',
      averageHours: '平均时长',
      employeeCount: '员工数',
      thisWeek: '本周',
      thisMonth: '本月',
      today: '今天'
    }
  },

  // 班次模板
  shiftTemplates: {
    title: '班次模板',
    create: '创建模板',
    edit: '编辑模板',
    delete: '删除模板',
    duplicate: '复制模板',

    form: {
      name: '模板名称',
      nameRequired: '请输入模板名称',
      startTime: '开始时间',
      endTime: '结束时间',
      duration: '时长',
      hours: '{hours} 小时',
      color: '颜色',
      description: '描述',
      isActive: '启用此模板'
    },

    usage: {
      title: '使用情况',
      timesUsed: '使用次数',
      lastUsed: '最后使用',
      never: '从未使用'
    },

    colors: {
      blue: '蓝色',
      green: '绿色',
      orange: '橙色',
      purple: '紫色',
      red: '红色',
      pink: '粉色',
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

  // 换班申请
  swapRequests: {
    title: '换班申请',
    create: '申请换班',
    approve: '批准',
    reject: '拒绝',
    cancel: '取消申请',

    status: {
      pending: '待审核',
      approved: '已批准',
      rejected: '已拒绝',
      cancelled: '已取消'
    },

    form: {
      requester: '申请人',
      target: '目标员工',
      reason: '换班原因',
      reasonRequired: '请输入换班原因',
      originalShift: '原班次',
      targetShift: '目标班次',
      selectOriginal: '选择要换的班次',
      selectTarget: '选择目标班次',
      noAvailableShifts: '暂无可用班次'
    },

    details: {
      requestedBy: '申请人',
      requestedAt: '申请时间',
      swapWith: '换班对象',
      reason: '换班原因',
      originalShiftDetails: '原班次详情',
      targetShiftDetails: '目标班次详情',
      approvedBy: '批准人',
      approvedAt: '批准时间',
      rejectedBy: '拒绝人',
      rejectedAt: '拒绝时间',
      rejectionReason: '拒绝原因'
    },

    actions: {
      viewDetails: '查看详情',
      approveConfirm: '确定要批准这个换班申请吗？',
      rejectConfirm: '确定要拒绝这个换班申请吗？',
      cancelConfirm: '确定要取消这个换班申请吗？'
    }
  },

  status: {
    scheduled: '已排班',
    confirmed: '已确认',
    cancelled: '已取消',
    completed: '已完成',
    pending: '待处理',
    active: '活跃',
    inactive: '未激活'
  },

  weekdays: {
    short: {
      sunday: '周日',
      monday: '周一',
      tuesday: '周二',
      wednesday: '周三',
      thursday: '周四',
      friday: '周五',
      saturday: '周六'
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

  errors: {
    generic: '操作失败，请重试',
    networkError: '网络错误，请检查网络连接',
    notFound: '未找到数据',
    unauthorized: '您没有权限执行此操作',
    validationError: '数据验证失败',
    requiredField: '此字段为必填项',
    invalidDate: '日期格式无效',
    invalidTime: '时间格式无效',
    startTimeAfterEndTime: '开始时间必须早于结束时间',
    dateInPast: '日期不能是过去时间',
    duplicateSchedule: '此时间段已存在排班',
    loadFailed: '加载失败',
    saveFailed: '保存失败',
    deleteFailed: '删除失败'
  },

  success: {
    saved: '保存成功',
    deleted: '删除成功',
    created: '创建成功',
    updated: '更新成功',
    scheduled: '排班成功',
    cancelled: '取消成功',
    confirmed: '确认成功',
    approved: '批准成功',
    rejected: '拒绝成功',
    exported: '导出成功',
    imported: '导入成功'
  },

  confirmations: {
    delete: '确定要删除吗？',
    deleteSchedule: '确定要删除这个排班吗？',
    deleteTemplate: '确定要删除这个模板吗？',
    cancel: '确定要取消吗？',
    unsavedChanges: '有未保存的更改，确定要离开吗？',
    batchDelete: '确定要删除选中的 {count} 项吗？'
  },

  // 图表组件
  charts: {
    workHours: {
      title: '总工时统计',
      customPeriod: '自定义期间',
      barChart: '柱状图',
      lineChart: '折线图',
      totalHours: '总工时',
      averageHours: '平均工时',
      employeeCount: '员工数',
      loadFailed: '加载数据失败',
      top10: '前10名',
      hoursUnit: 'h'
    },
    shiftDistribution: {
      title: '班次分布统计',
      doughnutChart: '环形图',
      pieChart: '饼图',
      distribution: '班次分布',
      people: '人',
      loadFailed: '加载数据失败'
    },
    trend: {
      title: '工时趋势分析',
      totalHours: '总工时',
      averageHours: '平均工时',
      scheduleCount: '排班数量',
      last7Days: '最近 7 天',
      last30Days: '最近 30 天',
      last90Days: '最近 90 天',
      currentValue: '当前值',
      trend: '趋势',
      changeRate: '变化率',
      upTrend: '上升趋势',
      downTrend: '下降趋势',
      stable: '持平',
      items: '个',
      loadFailed: '加载数据失败'
    }
  },

  // 页面标题与导航
  header: {
    title: 'MakanMakan 管理后台',
    home: '首页',
    realtime: {
      connected: '实时连线',
      disconnected: '连线中断'
    },
    userMenu: {
      logout: '退出登录'
    },
    breadcrumb: {
      home: '首页',
      orders: '订单管理',
      menu: '菜单管理',
      tables: '桌台管理',
      users: '员工管理',
      analytics: '数据分析'
    },
    roles: {
      admin: '系统管理员',
      owner: '店主',
      chef: '厨师',
      service: '服务员',
      cashier: '收银员'
    }
  }
}

export default zhCN
