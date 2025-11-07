import { Messages } from '../index'

/**
 * Bản dịch tiếng Việt
 */
const viVN: Messages = {
  // Từ vựng chung
  common: {
    save: 'Lưu',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    delete: 'Xóa',
    edit: 'Chỉnh sửa',
    add: 'Thêm',
    search: 'Tìm kiếm',
    filter: 'Lọc',
    export: 'Xuất',
    import: 'Nhập',
    refresh: 'Làm mới',
    loading: 'Đang tải...',
    noData: 'Không có dữ liệu',
    submit: 'Gửi',
    reset: 'Đặt lại',
    back: 'Quay lại',
    next: 'Tiếp theo',
    previous: 'Trước đó',
    close: 'Đóng',
    view: 'Xem',
    download: 'Tải xuống',
    upload: 'Tải lên',
    select: 'Chọn',
    selectAll: 'Chọn tất cả',
    deselectAll: 'Bỏ chọn tất cả',
    actions: 'Hành động',
    status: 'Trạng thái',
    createdAt: 'Ngày tạo',
    updatedAt: 'Ngày cập nhật',
    yes: 'Có',
    no: 'Không',
    fillRequired: 'Vui lòng điền vào các trường bắt buộc'
  },

  // Hệ thống lịch làm việc
  scheduling: {
    title: 'Lịch Làm Việc Nhân Viên',
    calendar: 'Xem lịch',
    list: 'Xem danh sách',
    createSchedule: 'Tạo lịch làm việc',
    editSchedule: 'Chỉnh sửa lịch',
    deleteSchedule: 'Xóa lịch',
    scheduleDetails: 'Chi tiết lịch làm việc',

    filters: {
      searchEmployee: 'Tìm tên nhân viên...',
      dateRange: 'Khoảng thời gian',
      startDate: 'Ngày bắt đầu',
      endDate: 'Ngày kết thúc',
      status: 'Trạng thái',
      allStatus: 'Tất cả trạng thái',
      shift: 'Ca làm',
      allShifts: 'Tất cả ca làm'
    },

    columns: {
      date: 'Ngày',
      weekday: 'Thứ',
      employee: 'Nhân viên',
      shift: 'Ca làm',
      startTime: 'Giờ bắt đầu',
      endTime: 'Giờ kết thúc',
      hours: 'Số giờ',
      status: 'Trạng thái',
      notes: 'Ghi chú'
    },

    form: {
      selectEmployee: 'Chọn nhân viên',
      selectShift: 'Chọn ca làm',
      selectDate: 'Chọn ngày',
      workDate: 'Ngày làm việc',
      shiftTemplate: 'Mẫu ca làm',
      notes: 'Ghi chú',
      addNotes: 'Thêm ghi chú...',
      repeatSchedule: 'Lặp lại lịch',
      repeatDays: 'Số ngày lặp lại',
      repeatUntil: 'Lặp lại đến'
    },

    batch: {
      title: 'Thao tác hàng loạt',
      selected: 'Đã chọn {count}',
      confirmAll: 'Xác nhận tất cả',
      cancelAll: 'Hủy tất cả',
      deleteAll: 'Xóa tất cả',
      exportSelected: 'Xuất các mục đã chọn',
      confirmAction: 'Bạn có chắc muốn thực hiện thao tác này trên {count} lịch làm việc?'
    },

    pagination: {
      showing: 'Hiển thị {start}-{end} trong tổng số {total}',
      itemsPerPage: 'mục/trang',
      firstPage: 'Trang đầu',
      lastPage: 'Trang cuối',
      previousPage: 'Trang trước',
      nextPage: 'Trang sau'
    },

    conflicts: {
      title: 'Xung đột lịch làm việc',
      detected: 'Phát hiện {count} xung đột',
      noConflicts: 'Không có xung đột',
      overlapShift: 'Ca làm trùng lặp',
      exceedHours: 'Làm thêm giờ',
      leaveConflict: 'Xung đột nghỉ phép',
      maxConsecutiveDays: 'Vượt quá số ngày làm việc liên tục',
      insufficientRest: 'Thời gian nghỉ không đủ',
      resolve: 'Giải quyết',
      ignore: 'Bỏ qua',
      details: 'Chi tiết xung đột'
    },

    stats: {
      totalSchedules: 'Tổng số lịch',
      totalHours: 'Tổng số giờ',
      averageHours: 'Số giờ trung bình',
      employeeCount: 'Số nhân viên',
      thisWeek: 'Tuần này',
      thisMonth: 'Tháng này',
      today: 'Hôm nay'
    }
  },

  // Mẫu ca làm việc
  shiftTemplates: {
    title: 'Mẫu Ca Làm',
    create: 'Tạo mẫu',
    edit: 'Chỉnh sửa mẫu',
    delete: 'Xóa mẫu',
    duplicate: 'Sao chép mẫu',

    form: {
      name: 'Tên mẫu',
      nameRequired: 'Vui lòng nhập tên mẫu',
      startTime: 'Giờ bắt đầu',
      endTime: 'Giờ kết thúc',
      duration: 'Thời lượng',
      hours: '{hours} giờ',
      color: 'Màu sắc',
      description: 'Mô tả',
      isActive: 'Kích hoạt mẫu này'
    },

    usage: {
      title: 'Thống kê sử dụng',
      timesUsed: 'Số lần sử dụng',
      lastUsed: 'Lần sử dụng cuối',
      never: 'Chưa sử dụng'
    },

    colors: {
      blue: 'Xanh dương',
      green: 'Xanh lá',
      orange: 'Cam',
      purple: 'Tím',
      red: 'Đỏ',
      pink: 'Hồng',
      cyan: 'Xanh lơ',
      gray: 'Xám'
    },

    presets: {
      morning: 'Ca sáng',
      afternoon: 'Ca chiều',
      evening: 'Ca tối',
      night: 'Ca đêm',
      fullDay: 'Cả ngày'
    }
  },

  // Yêu cầu đổi ca
  swapRequests: {
    title: 'Yêu Cầu Đổi Ca',
    create: 'Yêu cầu đổi ca',
    approve: 'Phê duyệt',
    reject: 'Từ chối',
    cancel: 'Hủy yêu cầu',

    status: {
      pending: 'Đang chờ',
      approved: 'Đã phê duyệt',
      rejected: 'Đã từ chối',
      cancelled: 'Đã hủy'
    },

    form: {
      requester: 'Người yêu cầu',
      target: 'Nhân viên đổi ca',
      reason: 'Lý do',
      reasonRequired: 'Vui lòng nhập lý do',
      originalShift: 'Ca hiện tại',
      targetShift: 'Ca muốn đổi',
      selectOriginal: 'Chọn ca muốn đổi',
      selectTarget: 'Chọn ca của đối tác',
      noAvailableShifts: 'Không có ca nào khả dụng'
    },

    details: {
      requestedBy: 'Người yêu cầu',
      requestedAt: 'Thời gian yêu cầu',
      swapWith: 'Đổi với',
      reason: 'Lý do',
      originalShiftDetails: 'Chi tiết ca hiện tại',
      targetShiftDetails: 'Chi tiết ca muốn đổi',
      approvedBy: 'Người phê duyệt',
      approvedAt: 'Thời gian phê duyệt',
      rejectedBy: 'Người từ chối',
      rejectedAt: 'Thời gian từ chối',
      rejectionReason: 'Lý do từ chối'
    },

    actions: {
      viewDetails: 'Xem chi tiết',
      approveConfirm: 'Bạn có chắc muốn phê duyệt yêu cầu đổi ca này?',
      rejectConfirm: 'Bạn có chắc muốn từ chối yêu cầu đổi ca này?',
      cancelConfirm: 'Bạn có chắc muốn hủy yêu cầu đổi ca này?'
    }
  },

  status: {
    scheduled: 'Đã xếp lịch',
    confirmed: 'Đã xác nhận',
    cancelled: 'Đã hủy',
    completed: 'Hoàn thành',
    pending: 'Đang chờ',
    active: 'Đang hoạt động',
    inactive: 'Không hoạt động'
  },

  weekdays: {
    short: {
      sunday: 'CN',
      monday: 'T2',
      tuesday: 'T3',
      wednesday: 'T4',
      thursday: 'T5',
      friday: 'T6',
      saturday: 'T7'
    },
    long: {
      sunday: 'Chủ nhật',
      monday: 'Thứ hai',
      tuesday: 'Thứ ba',
      wednesday: 'Thứ tư',
      thursday: 'Thứ năm',
      friday: 'Thứ sáu',
      saturday: 'Thứ bảy'
    }
  },

  errors: {
    generic: 'Thao tác thất bại, vui lòng thử lại',
    networkError: 'Lỗi mạng, vui lòng kiểm tra kết nối',
    notFound: 'Không tìm thấy dữ liệu',
    unauthorized: 'Bạn không có quyền thực hiện thao tác này',
    validationError: 'Xác thực dữ liệu thất bại',
    requiredField: 'Trường này là bắt buộc',
    invalidDate: 'Định dạng ngày không hợp lệ',
    invalidTime: 'Định dạng giờ không hợp lệ',
    startTimeAfterEndTime: 'Giờ bắt đầu phải trước giờ kết thúc',
    dateInPast: 'Ngày không thể là quá khứ',
    duplicateSchedule: 'Đã có lịch làm việc trong khung giờ này',
    loadFailed: 'Tải thất bại',
    saveFailed: 'Lưu thất bại',
    deleteFailed: 'Xóa thất bại'
  },

  success: {
    saved: 'Đã lưu thành công',
    deleted: 'Đã xóa thành công',
    created: 'Đã tạo thành công',
    updated: 'Đã cập nhật thành công',
    scheduled: 'Đã xếp lịch thành công',
    cancelled: 'Đã hủy thành công',
    confirmed: 'Đã xác nhận thành công',
    approved: 'Đã phê duyệt thành công',
    rejected: 'Đã từ chối thành công',
    exported: 'Đã xuất thành công',
    imported: 'Đã nhập thành công'
  },

  confirmations: {
    delete: 'Bạn có chắc muốn xóa?',
    deleteSchedule: 'Bạn có chắc muốn xóa lịch làm việc này?',
    deleteTemplate: 'Bạn có chắc muốn xóa mẫu này?',
    cancel: 'Bạn có chắc muốn hủy?',
    unsavedChanges: 'Có thay đổi chưa được lưu, bạn có chắc muốn rời đi?',
    batchDelete: 'Bạn có chắc muốn xóa {count} mục đã chọn?'
  },

  // Biểu đồ
  charts: {
    workHours: {
      title: 'Thống kê Tổng Giờ Làm',
      customPeriod: 'Tùy chỉnh thời gian',
      barChart: 'Biểu đồ cột',
      lineChart: 'Biểu đồ đường',
      totalHours: 'Tổng giờ làm',
      averageHours: 'Giờ làm trung bình',
      employeeCount: 'Số nhân viên',
      loadFailed: 'Tải dữ liệu thất bại',
      top10: 'Top 10',
      hoursUnit: 'h'
    },
    shiftDistribution: {
      title: 'Phân Bố Ca Làm',
      doughnutChart: 'Biểu đồ vòng tròn',
      pieChart: 'Biểu đồ bánh',
      distribution: 'Phân bố ca làm',
      people: 'người',
      loadFailed: 'Tải dữ liệu thất bại'
    },
    trend: {
      title: 'Phân Tích Xu Hướng Giờ Làm',
      totalHours: 'Tổng giờ làm',
      averageHours: 'Giờ làm trung bình',
      scheduleCount: 'Số lịch làm việc',
      last7Days: '7 ngày gần đây',
      last30Days: '30 ngày gần đây',
      last90Days: '90 ngày gần đây',
      currentValue: 'Giá trị hiện tại',
      trend: 'Xu hướng',
      changeRate: 'Tỷ lệ thay đổi',
      upTrend: 'Xu hướng tăng',
      downTrend: 'Xu hướng giảm',
      stable: 'Ổn định',
      items: 'mục',
      loadFailed: 'Tải dữ liệu thất bại'
    }
  },

  // Hệ thống đặt bàn
  reservation: {
    title: 'Quản Lý Đặt Bàn',
    create: 'Đặt bàn mới',
    createSuccess: 'Đặt bàn thành công',
    createError: 'Đặt bàn thất bại',
    loadError: 'Tải danh sách đặt bàn thất bại',
    confirmPrompt: 'Bạn có chắc muốn xác nhận đặt bàn này?',
    confirmError: 'Xác nhận đặt bàn thất bại',
    arrivedError: 'Đánh dấu đã đến thất bại',
    seatedError: 'Đánh dấu đã ngồi thất bại',
    cancelPrompt: 'Bạn có chắc muốn hủy đặt bàn này?',
    cancelError: 'Hủy đặt bàn thất bại',
    confirmationCode: 'Mã xác nhận',
    customerName: 'Tên khách hàng',
    customerPhone: 'Số điện thoại',
    customerEmail: 'Email',
    datetime: 'Thời gian đặt',
    selectDatetime: 'Chọn thời gian đặt',
    partySize: 'Số người',
    people: 'người',
    duration: 'Thời lượng',
    minutes: 'phút',
    specialRequests: 'Yêu cầu đặc biệt',
    specialRequestsPlaceholder: 'VD: ghế trẻ em, lối đi xe lăn, chỗ ngồi cửa sổ, v.v.',
    notes: 'Ghi chú',
    status: 'Trạng thái',
    detail: 'Chi tiết đặt bàn',
    stats: {
      total: 'Tổng số đặt bàn',
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      seated: 'Đã ngồi'
    },
    filter: {
      date: 'Ngày',
      selectDate: 'Chọn ngày',
      status: 'Trạng thái',
      allStatus: 'Tất cả trạng thái',
      phone: 'Số điện thoại',
      enterPhone: 'Nhập số điện thoại'
    }
  },

  // Hệ thống xếp hàng chờ
  waitingList: {
    title: 'Quản Lý Xếp Hàng',
    addCustomer: 'Thêm vào hàng chờ',
    addSuccess: 'Thêm vào hàng chờ thành công',
    addError: 'Thêm vào hàng chờ thất bại',
    loadError: 'Tải danh sách chờ thất bại',
    callCustomer: 'Gọi khách',
    callError: 'Gọi khách thất bại',
    confirmCall: 'Xác nhận gọi',
    call: 'Gọi',
    callNext: 'Gọi người tiếp theo',
    seat: 'Vào chỗ',
    expire: 'Hết hạn',
    cancel: 'Hủy',
    seatedError: 'Đánh dấu đã ngồi thất bại',
    expirePrompt: 'Bạn có chắc muốn đánh dấu là hết hạn?',
    expireError: 'Đánh dấu hết hạn thất bại',
    cancelPrompt: 'Bạn có chắc muốn hủy mục này?',
    cancelError: 'Hủy thất bại',
    batchCallError: 'Gọi hàng loạt thất bại',
    customerName: 'Tên khách hàng',
    customerPhone: 'Số điện thoại',
    partySize: 'Số người',
    people: 'người',
    notes: 'Ghi chú',
    notesPlaceholder: 'VD: xe đẩy em bé, nhu cầu đặc biệt, v.v.',
    queueNumber: 'Số thứ tự',
    waitTime: 'Thời gian chờ',
    joinedAt: 'Thời gian tham gia',
    estimatedWait: 'Thời gian chờ ước tính',
    partiesAhead: 'Số nhóm phía trước',
    availableTables: 'Số bàn trống',
    assignTable: 'Gán bàn',
    selectTable: 'Chọn bàn',
    selectTableRequired: 'Vui lòng chọn bàn để gán',
    notificationMethod: 'Phương thức thông báo',
    sms: 'SMS',
    display: 'Màn hình',
    both: 'Cả hai',
    queue: 'Hàng chờ',
    noQueue: 'Không có người chờ',
    cardView: 'Xem thẻ',
    tableView: 'Xem bảng',
    stats: {
      waiting: 'Đang chờ',
      called: 'Đã gọi',
      avgWait: 'Chờ TB',
      todayTotal: 'Tổng hôm nay'
    },
    filter: {
      status: 'Trạng thái',
      allStatus: 'Tất cả trạng thái',
      phone: 'Số điện thoại',
      enterPhone: 'Nhập số điện thoại'
    }
  },

  // Tiêu đề trang và điều hướng
  header: {
    title: 'Trang Quản Trị MakanMakan',
    home: 'Trang chủ',
    realtime: {
      connected: 'Kết nối trực tiếp',
      disconnected: 'Mất kết nối'
    },
    userMenu: {
      logout: 'Đăng xuất'
    },
    breadcrumb: {
      home: 'Trang chủ',
      orders: 'Quản lý đơn hàng',
      menu: 'Quản lý thực đơn',
      tables: 'Quản lý bàn',
      users: 'Quản lý nhân viên',
      analytics: 'Phân tích dữ liệu'
    },
    roles: {
      admin: 'Quản trị viên',
      owner: 'Chủ cửa hàng',
      chef: 'Đầu bếp',
      service: 'Nhân viên phục vụ',
      cashier: 'Thu ngân'
    }
  }
}

export default viVN
