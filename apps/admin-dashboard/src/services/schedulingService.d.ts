/**
 * Employee Scheduling Service
 * API client for employee scheduling and shift management
 */
import type { ShiftTemplate, CreateShiftTemplateData, EmployeeSchedule, CreateScheduleData, UpdateScheduleData, BulkCreateSchedulesData, AvailableEmployee, SchedulingConflict, SwapRequest, CreateSwapRequestData, ClockInData, ClockOutData, ScheduleFilters, ConflictFilters, SwapRequestFilters, PaginatedResponse, DailyStats, WeeklySummary } from '@/types/scheduling';
declare class SchedulingService {
    private api;
    private baseURL;
    constructor();
    /**
     * Get all shift templates for a restaurant
     */
    getShiftTemplates(restaurantId: number): Promise<ShiftTemplate[]>;
    /**
     * Get a specific shift template
     */
    getShiftTemplate(id: number): Promise<ShiftTemplate>;
    /**
     * Create a new shift template
     */
    createShiftTemplate(restaurantId: number, data: CreateShiftTemplateData): Promise<ShiftTemplate>;
    /**
     * Update a shift template
     */
    updateShiftTemplate(id: number, data: Partial<CreateShiftTemplateData>): Promise<ShiftTemplate>;
    /**
     * Delete a shift template
     */
    deleteShiftTemplate(id: number): Promise<void>;
    /**
     * Get employee schedules with filters
     */
    getSchedules(filters: ScheduleFilters): Promise<PaginatedResponse<EmployeeSchedule>>;
    /**
     * Get a specific schedule
     */
    getSchedule(id: number): Promise<EmployeeSchedule>;
    /**
     * Create a new schedule
     */
    createSchedule(restaurantId: number, data: CreateScheduleData): Promise<EmployeeSchedule>;
    /**
     * Update a schedule
     */
    updateSchedule(id: number, data: UpdateScheduleData): Promise<EmployeeSchedule>;
    /**
     * Delete (cancel) a schedule
     */
    deleteSchedule(id: number): Promise<void>;
    /**
     * Bulk create schedules
     */
    bulkCreateSchedules(restaurantId: number, data: BulkCreateSchedulesData): Promise<{
        count: number;
    }>;
    /**
     * Get available employees for scheduling on a specific date
     * Filters out employees on approved leave
     */
    getAvailableEmployees(restaurantId: number, date: string, shiftTemplateId?: number): Promise<AvailableEmployee[]>;
    /**
     * Clock in to a shift
     */
    clockIn(id: number, data: ClockInData): Promise<EmployeeSchedule>;
    /**
     * Clock out from a shift
     */
    clockOut(id: number, data: ClockOutData): Promise<EmployeeSchedule>;
    /**
     * Get scheduling conflicts
     */
    getConflicts(filters: ConflictFilters): Promise<PaginatedResponse<SchedulingConflict>>;
    /**
     * Resolve a conflict
     */
    resolveConflict(id: number, userId: number, resolutionNotes: string): Promise<SchedulingConflict>;
    /**
     * Get swap requests
     */
    getSwapRequests(filters: SwapRequestFilters): Promise<PaginatedResponse<SwapRequest>>;
    /**
     * Create a swap request
     */
    createSwapRequest(restaurantId: number, data: CreateSwapRequestData): Promise<SwapRequest>;
    /**
     * Approve a swap request
     */
    approveSwapRequest(id: number, managerId: number): Promise<SwapRequest>;
    /**
     * Reject a swap request
     */
    rejectSwapRequest(id: number, managerId: number, reason: string): Promise<SwapRequest>;
    /**
     * Get daily scheduling statistics
     */
    getDailyStats(restaurantId: number, date: string): Promise<DailyStats>;
    /**
     * Get weekly summary
     */
    getWeeklySummary(restaurantId: number, weekStartDate: string): Promise<WeeklySummary>;
}
export declare const schedulingService: SchedulingService;
export default schedulingService;
