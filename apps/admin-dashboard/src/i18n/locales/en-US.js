/**
 * English Translation
 */
const enUS = {
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
        no: 'No',
        fillRequired: 'Please fill in required fields'
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
    // Reservation system
    reservation: {
        title: 'Reservation Management',
        create: 'New Reservation',
        createSuccess: 'Reservation created successfully',
        createError: 'Failed to create reservation',
        loadError: 'Failed to load reservations',
        confirmPrompt: 'Are you sure you want to confirm this reservation?',
        confirmError: 'Failed to confirm reservation',
        arrivedError: 'Failed to mark as arrived',
        seatedError: 'Failed to mark as seated',
        cancelPrompt: 'Are you sure you want to cancel this reservation?',
        cancelError: 'Failed to cancel reservation',
        confirmationCode: 'Confirmation Code',
        customerName: 'Customer Name',
        customerPhone: 'Contact Phone',
        customerEmail: 'Email',
        datetime: 'Reservation Time',
        selectDatetime: 'Select reservation time',
        partySize: 'Party Size',
        people: 'people',
        duration: 'Duration',
        minutes: 'minutes',
        specialRequests: 'Special Requests',
        specialRequestsPlaceholder: 'E.g., child seat, wheelchair access, window seat, etc.',
        notes: 'Notes',
        status: 'Status',
        detail: 'Reservation Details',
        stats: {
            total: 'Total Reservations',
            pending: 'Pending',
            confirmed: 'Confirmed',
            seated: 'Seated'
        },
        filter: {
            date: 'Date',
            selectDate: 'Select date',
            status: 'Status',
            allStatus: 'All Status',
            phone: 'Phone Number',
            enterPhone: 'Enter phone number'
        }
    },
    // Waiting list system
    waitingList: {
        title: 'Waiting List Management',
        addCustomer: 'Add to Waiting List',
        addSuccess: 'Added to waiting list successfully',
        addError: 'Failed to add to waiting list',
        loadError: 'Failed to load waiting list',
        callCustomer: 'Call Customer',
        callError: 'Failed to call customer',
        confirmCall: 'Confirm Call',
        call: 'Call',
        callNext: 'Call Next',
        seat: 'Seat',
        expire: 'Expire',
        cancel: 'Cancel',
        seatedError: 'Failed to mark as seated',
        expirePrompt: 'Are you sure you want to mark as expired?',
        expireError: 'Failed to mark as expired',
        cancelPrompt: 'Are you sure you want to cancel this entry?',
        cancelError: 'Failed to cancel',
        batchCallError: 'Failed to batch call',
        customerName: 'Customer Name',
        customerPhone: 'Contact Phone',
        partySize: 'Party Size',
        people: 'people',
        notes: 'Notes',
        notesPlaceholder: 'E.g., stroller, special needs, etc.',
        queueNumber: 'Queue Number',
        waitTime: 'Wait Time',
        joinedAt: 'Joined At',
        estimatedWait: 'Estimated Wait Time',
        partiesAhead: 'Parties Ahead',
        availableTables: 'Available Tables',
        assignTable: 'Assign Table',
        selectTable: 'Select table',
        selectTableRequired: 'Please select a table to assign',
        notificationMethod: 'Notification Method',
        sms: 'SMS',
        display: 'Display',
        both: 'Both',
        queue: 'Queue',
        noQueue: 'No one waiting',
        cardView: 'Card View',
        tableView: 'Table View',
        stats: {
            waiting: 'Waiting',
            called: 'Called',
            avgWait: 'Avg Wait',
            todayTotal: 'Today Total'
        },
        filter: {
            status: 'Status',
            allStatus: 'All Status',
            phone: 'Phone Number',
            enterPhone: 'Enter phone number'
        }
    },
    // System Monitoring
    monitoring: {
        title: 'System Monitoring',
        subtitle: 'Real-time system health, performance metrics and alerts',
        actions: {
            refresh: 'Refresh Now',
            refreshing: 'Refreshing...',
            autoRefresh: 'Auto Refresh',
            manualRefresh: 'Manual Refresh',
            createAlertRule: 'Create Alert Rule',
            testAlert: 'Test Alert',
            resetMetrics: 'Reset Metrics',
            exportReport: 'Export Report'
        },
        health: {
            overall: 'Overall Health Status',
            score: 'Health Score',
            uptime: 'System Uptime',
            lastUpdate: 'Last Update',
            status: {
                healthy: 'Healthy',
                warning: 'Warning',
                critical: 'Critical',
                down: 'Down'
            }
        },
        keyMetrics: {
            title: 'Key Metrics',
            requestsPerMinute: 'Requests Per Minute',
            averageResponseTime: 'Average Response Time',
            cacheHitRate: 'Cache Hit Rate',
            activeErrors: 'Active Errors'
        },
        components: {
            title: 'System Components Status',
            api: 'API Service',
            database: 'Database',
            cache: 'Cache Service',
            external: 'External Services',
            status: 'Status',
            latency: 'Latency',
            healthy: 'Healthy',
            issues: 'Issues'
        },
        tabs: {
            alerts: 'Alert Rules',
            performance: 'Performance Report',
            errors: 'Error Analysis'
        },
        alerts: {
            title: 'Alert Rules',
            noAlerts: 'No alert rules',
            createFirst: 'Create your first alert rule to monitor system status',
            rule: {
                name: 'Rule Name',
                type: 'Alert Type',
                severity: 'Severity',
                threshold: 'Threshold',
                enabled: 'Enabled',
                disabled: 'Disabled',
                lastTriggered: 'Last Triggered',
                actions: 'Actions'
            },
            severity: {
                info: 'Info',
                warning: 'Warning',
                critical: 'Critical',
                fatal: 'Fatal'
            },
            actions: {
                enable: 'Enable',
                disable: 'Disable',
                edit: 'Edit',
                delete: 'Delete',
                test: 'Test'
            },
            messages: {
                enabled: 'Alert rule enabled',
                disabled: 'Alert rule disabled',
                deleted: 'Alert rule deleted',
                deleteConfirm: 'Are you sure you want to delete this alert rule?'
            }
        },
        performance: {
            title: 'Performance Report',
            selectPeriod: 'Select Time Period',
            last1Day: 'Last 1 Day',
            last7Days: 'Last 7 Days',
            last30Days: 'Last 30 Days',
            api: {
                title: 'API Performance',
                totalRequests: 'Total Requests',
                averageResponseTime: 'Average Response Time',
                p95ResponseTime: 'P95 Response Time',
                errorRate: 'Error Rate'
            },
            database: {
                title: 'Database Performance',
                totalQueries: 'Total Queries',
                averageQueryTime: 'Average Query Time',
                slowQueries: 'Slow Queries',
                queryErrorRate: 'Query Error Rate'
            },
            cache: {
                title: 'Cache Performance',
                hitRate: 'Hit Rate',
                totalKeys: 'Total Keys',
                totalSize: 'Total Size',
                expiringKeys: 'Expiring Keys'
            },
            charts: {
                trendComparison: 'Performance Trend Comparison (Last 24 Hours)',
                cacheHitRate: 'Cache Hit Rate Trend (Last 24 Hours)',
                apiResponseTime: 'API Response Time',
                dbQueryTime: 'Database Query Time'
            },
            recommendations: {
                title: 'Optimization Recommendations',
                loading: 'Loading performance report...'
            }
        },
        errors: {
            title: 'Error Analysis',
            statistics: 'Error Type Statistics',
            details: 'Error Details',
            noErrors: 'No error records',
            systemRunningNormally: 'System running normally',
            occurredTimes: 'Occurred Times',
            errorCount: 'Error Count'
        },
        realtime: {
            title: 'Real-time Alerts',
            connectionStatus: {
                connected: 'Connected to alert system',
                reconnecting: 'Reconnecting',
                disconnected: 'Not connected',
                reconnect: 'Reconnect'
            },
            noAlerts: 'No alerts',
            systemNormal: 'System running normally',
            soundEnabled: 'Mute Sound',
            soundDisabled: 'Enable Sound',
            clearAll: 'Clear All',
            acknowledged: 'Acknowledged',
            currentValue: 'Current Value',
            threshold: 'Threshold',
            justNow: 'Just now',
            minutesAgo: '{count} minutes ago',
            hoursAgo: '{count} hours ago'
        },
        notifications: {
            dataUpdated: 'Monitoring data updated',
            updateFailed: 'Failed to update monitoring data',
            alertAcknowledged: 'Alert acknowledged',
            alertsCleared: 'All alerts cleared',
            reconnecting: 'Reconnecting...',
            connectionFailed: 'Cannot connect to alert system',
            loadingFailed: 'Failed to load monitoring data',
            performanceReportFailed: 'Failed to load performance report',
            autoRefreshEnabled: 'Auto refresh enabled',
            autoRefreshDisabled: 'Auto refresh disabled'
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
};
export default enUS;
