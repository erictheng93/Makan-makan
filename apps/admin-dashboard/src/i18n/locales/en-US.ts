import { Messages } from '../index'

/**
 * English Translation
 */
const enUS: Messages = {
  // Common vocabulary
  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    refresh: 'Refresh',
    loading: 'Loading...',
    noData: 'No Data',
    submit: 'Submit',
    reset: 'Reset',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    select: 'Select',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    actions: 'Actions',
    status: 'Status',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    yes: 'Yes',
    no: 'No'
  },

  // Scheduling system
  scheduling: {
    title: 'Employee Scheduling',
    calendar: 'Calendar View',
    list: 'List View',
    createSchedule: 'Create Schedule',
    editSchedule: 'Edit Schedule',
    deleteSchedule: 'Delete Schedule',
    scheduleDetails: 'Schedule Details',

    filters: {
      searchEmployee: 'Search employee name...',
      dateRange: 'Date Range',
      startDate: 'Start Date',
      endDate: 'End Date',
      status: 'Status',
      allStatus: 'All Status',
      shift: 'Shift',
      allShifts: 'All Shifts'
    },

    columns: {
      date: 'Date',
      weekday: 'Day',
      employee: 'Employee',
      shift: 'Shift',
      startTime: 'Start Time',
      endTime: 'End Time',
      hours: 'Hours',
      status: 'Status',
      notes: 'Notes'
    },

    form: {
      selectEmployee: 'Select Employee',
      selectShift: 'Select Shift',
      selectDate: 'Select Date',
      workDate: 'Work Date',
      shiftTemplate: 'Shift Template',
      notes: 'Notes',
      addNotes: 'Add notes...',
      repeatSchedule: 'Repeat Schedule',
      repeatDays: 'Repeat Days',
      repeatUntil: 'Repeat Until'
    },

    batch: {
      title: 'Batch Operations',
      selected: '{count} selected',
      confirmAll: 'Confirm All',
      cancelAll: 'Cancel All',
      deleteAll: 'Delete All',
      exportSelected: 'Export Selected',
      confirmAction: 'Are you sure you want to perform this action on {count} schedules?'
    },

    pagination: {
      showing: 'Showing {start}-{end} of {total}',
      itemsPerPage: 'per page',
      firstPage: 'First',
      lastPage: 'Last',
      previousPage: 'Previous',
      nextPage: 'Next'
    },

    conflicts: {
      title: 'Schedule Conflicts',
      detected: '{count} conflicts detected',
      noConflicts: 'No conflicts found',
      overlapShift: 'Shift Overlap',
      exceedHours: 'Overtime',
      leaveConflict: 'Leave Conflict',
      maxConsecutiveDays: 'Max Consecutive Days Exceeded',
      insufficientRest: 'Insufficient Rest',
      resolve: 'Resolve',
      ignore: 'Ignore',
      details: 'Conflict Details'
    },

    stats: {
      totalSchedules: 'Total Schedules',
      totalHours: 'Total Hours',
      averageHours: 'Average Hours',
      employeeCount: 'Employees',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      today: 'Today'
    }
  },

  // Shift templates
  shiftTemplates: {
    title: 'Shift Templates',
    create: 'Create Template',
    edit: 'Edit Template',
    delete: 'Delete Template',
    duplicate: 'Duplicate Template',

    form: {
      name: 'Template Name',
      nameRequired: 'Please enter template name',
      startTime: 'Start Time',
      endTime: 'End Time',
      duration: 'Duration',
      hours: '{hours} hours',
      color: 'Color',
      description: 'Description',
      isActive: 'Enable this template'
    },

    usage: {
      title: 'Usage Stats',
      timesUsed: 'Times Used',
      lastUsed: 'Last Used',
      never: 'Never Used'
    },

    colors: {
      blue: 'Blue',
      green: 'Green',
      orange: 'Orange',
      purple: 'Purple',
      red: 'Red',
      pink: 'Pink',
      cyan: 'Cyan',
      gray: 'Gray'
    },

    presets: {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
      fullDay: 'Full Day'
    }
  },

  // Swap requests
  swapRequests: {
    title: 'Swap Requests',
    create: 'Request Swap',
    approve: 'Approve',
    reject: 'Reject',
    cancel: 'Cancel Request',

    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled'
    },

    form: {
      requester: 'Requester',
      target: 'Target Employee',
      reason: 'Reason',
      reasonRequired: 'Please enter reason',
      originalShift: 'Original Shift',
      targetShift: 'Target Shift',
      selectOriginal: 'Select shift to swap',
      selectTarget: 'Select target shift',
      noAvailableShifts: 'No available shifts'
    },

    details: {
      requestedBy: 'Requested By',
      requestedAt: 'Requested At',
      swapWith: 'Swap With',
      reason: 'Reason',
      originalShiftDetails: 'Original Shift Details',
      targetShiftDetails: 'Target Shift Details',
      approvedBy: 'Approved By',
      approvedAt: 'Approved At',
      rejectedBy: 'Rejected By',
      rejectedAt: 'Rejected At',
      rejectionReason: 'Rejection Reason'
    },

    actions: {
      viewDetails: 'View Details',
      approveConfirm: 'Are you sure you want to approve this swap request?',
      rejectConfirm: 'Are you sure you want to reject this swap request?',
      cancelConfirm: 'Are you sure you want to cancel this swap request?'
    }
  },

  status: {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    pending: 'Pending',
    active: 'Active',
    inactive: 'Inactive'
  },

  weekdays: {
    short: {
      sunday: 'Sun',
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat'
    },
    long: {
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday'
    }
  },

  errors: {
    generic: 'Operation failed, please try again',
    networkError: 'Network error, please check your connection',
    notFound: 'Data not found',
    unauthorized: 'You do not have permission to perform this action',
    validationError: 'Data validation failed',
    requiredField: 'This field is required',
    invalidDate: 'Invalid date format',
    invalidTime: 'Invalid time format',
    startTimeAfterEndTime: 'Start time must be before end time',
    dateInPast: 'Date cannot be in the past',
    duplicateSchedule: 'Schedule already exists for this time slot',
    loadFailed: 'Failed to load',
    saveFailed: 'Failed to save',
    deleteFailed: 'Failed to delete'
  },

  success: {
    saved: 'Saved successfully',
    deleted: 'Deleted successfully',
    created: 'Created successfully',
    updated: 'Updated successfully',
    scheduled: 'Scheduled successfully',
    cancelled: 'Cancelled successfully',
    confirmed: 'Confirmed successfully',
    approved: 'Approved successfully',
    rejected: 'Rejected successfully',
    exported: 'Exported successfully',
    imported: 'Imported successfully'
  },

  confirmations: {
    delete: 'Are you sure you want to delete?',
    deleteSchedule: 'Are you sure you want to delete this schedule?',
    deleteTemplate: 'Are you sure you want to delete this template?',
    cancel: 'Are you sure you want to cancel?',
    unsavedChanges: 'You have unsaved changes, are you sure you want to leave?',
    batchDelete: 'Are you sure you want to delete the selected {count} items?'
  },

  // Chart components
  charts: {
    workHours: {
      title: 'Total Work Hours',
      customPeriod: 'Custom Period',
      barChart: 'Bar Chart',
      lineChart: 'Line Chart',
      totalHours: 'Total Hours',
      averageHours: 'Average Hours',
      employeeCount: 'Employees',
      loadFailed: 'Failed to load data',
      top10: 'Top 10',
      hoursUnit: 'h'
    },
    shiftDistribution: {
      title: 'Shift Distribution',
      doughnutChart: 'Doughnut Chart',
      pieChart: 'Pie Chart',
      distribution: 'Shift Distribution',
      people: 'people',
      loadFailed: 'Failed to load data'
    },
    trend: {
      title: 'Work Hours Trend Analysis',
      totalHours: 'Total Hours',
      averageHours: 'Average Hours',
      scheduleCount: 'Schedule Count',
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days',
      last90Days: 'Last 90 Days',
      currentValue: 'Current Value',
      trend: 'Trend',
      changeRate: 'Change Rate',
      upTrend: 'Upward Trend',
      downTrend: 'Downward Trend',
      stable: 'Stable',
      items: 'items',
      loadFailed: 'Failed to load data'
    }
  },

  // Page title and navigation
  header: {
    title: 'MakanMakan Admin Dashboard',
    home: 'Home',
    realtime: {
      connected: 'Real-time Connected',
      disconnected: 'Connection Lost'
    },
    userMenu: {
      logout: 'Logout'
    },
    breadcrumb: {
      home: 'Home',
      orders: 'Orders',
      menu: 'Menu',
      tables: 'Tables',
      users: 'Users',
      analytics: 'Analytics'
    },
    roles: {
      admin: 'Admin',
      owner: 'Owner',
      chef: 'Chef',
      service: 'Server',
      cashier: 'Cashier'
    }
  }
}

export default enUS
