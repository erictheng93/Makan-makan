/**
 * 訂位狀態
 */
export declare enum ReservationStatus {
    PENDING = "pending",// 待確認
    CONFIRMED = "confirmed",// 已確認
    ARRIVED = "arrived",// 已到店
    SEATED = "seated",// 已入座
    COMPLETED = "completed",// 已完成
    CANCELLED = "cancelled",// 已取消
    NO_SHOW = "no_show"
}
/**
 * 訂位實體
 */
export interface Reservation {
    id: string;
    restaurantId: string;
    customerId?: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    partySize: number;
    reservationDate: string;
    reservationTime: string;
    durationMinutes: number;
    tableId?: number;
    specialRequests?: string;
    status: ReservationStatus;
    confirmationCode: string;
    notes?: string;
    createdAt: number;
    confirmedAt?: number;
    remindedAt?: number;
    arrivedAt?: number;
    seatedAt?: number;
    completedAt?: number;
    cancelledAt?: number;
    noShowAt?: number;
    updatedAt: number;
}
/**
 * 建立訂位請求
 */
export interface CreateReservationRequest {
    restaurantId: string;
    customerId?: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    partySize: number;
    reservationDate: string;
    reservationTime: string;
    durationMinutes?: number;
    specialRequests?: string;
}
/**
 * 更新訂位請求
 */
export interface UpdateReservationRequest {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    partySize?: number;
    reservationDate?: string;
    reservationTime?: string;
    durationMinutes?: number;
    tableId?: number;
    specialRequests?: string;
    notes?: string;
}
/**
 * 訂位查詢過濾器
 */
export interface ReservationFilters {
    restaurantId?: string;
    customerId?: number;
    customerPhone?: string;
    status?: ReservationStatus | ReservationStatus[];
    reservationDate?: string;
    startDate?: string;
    endDate?: string;
    tableId?: number;
    confirmationCode?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'reservationDate' | 'reservationTime';
    sortOrder?: 'asc' | 'desc';
}
/**
 * 訂位回應（含桌位資訊）
 */
export interface ReservationResponse extends Reservation {
    table?: {
        id: number;
        number: string;
        capacity: number;
        location?: string;
    };
    customer?: {
        id: number;
        fullName: string;
        email?: string;
        phone?: string;
    };
}
/**
 * 時段可用性查詢請求
 */
export interface AvailabilityRequest {
    restaurantId: string;
    date: string;
    partySize: number;
    duration?: number;
}
/**
 * 時段可用性回應
 */
export interface TimeSlotAvailability {
    time: string;
    available: boolean;
    remainingCapacity: number;
    remainingTables: number;
    occupancyRate: number;
    reason?: string;
}
/**
 * 可用性查詢回應
 */
export interface AvailabilityResponse {
    date: string;
    partySize: number;
    slots: TimeSlotAvailability[];
}
/**
 * 候位狀態
 */
export declare enum WaitingStatus {
    WAITING = "waiting",// 等待中
    CALLED = "called",// 已叫號
    CONFIRMED = "confirmed",// 已確認
    SEATED = "seated",// 已入座
    CANCELLED = "cancelled",// 已取消
    EXPIRED = "expired",// 已過號
    NO_SHOW = "no_show"
}
/**
 * 候位實體
 */
export interface WaitingListEntry {
    id: string;
    restaurantId: string;
    customerId?: number;
    customerName: string;
    customerPhone: string;
    partySize: number;
    preferredTableType?: string;
    queueNumber: number;
    queueLetter?: string;
    priority: number;
    estimatedWaitMinutes?: number;
    tableId?: number;
    status: WaitingStatus;
    notes?: string;
    createdAt: number;
    calledAt?: number;
    notifiedAt?: number;
    confirmedAt?: number;
    seatedAt?: number;
    cancelledAt?: number;
    expiredAt?: number;
    timeoutAt?: number;
    updatedAt: number;
}
/**
 * 加入候位請求
 */
export interface JoinWaitingListRequest {
    restaurantId: string;
    customerId?: number;
    customerName: string;
    customerPhone: string;
    partySize: number;
    preferredTableType?: '2-person' | '4-person' | '6-person+';
    notes?: string;
}
/**
 * 候位查詢過濾器
 */
export interface WaitingListFilters {
    restaurantId?: string;
    status?: WaitingStatus | WaitingStatus[];
    customerPhone?: string;
    date?: string;
    page?: number;
    limit?: number;
}
/**
 * 候位回應（含位置資訊）
 */
export interface WaitingListResponse extends WaitingListEntry {
    queueDisplay: string;
    partiesAhead: number;
    table?: {
        id: number;
        number: string;
        capacity: number;
    };
}
/**
 * 叫號請求
 */
export interface CallWaitingRequest {
    tableId: number;
}
/**
 * 候位隊列狀態
 */
export interface QueueStatus {
    restaurantId: string;
    totalWaiting: number;
    averageWaitMinutes: number;
    availableTables: number;
    byTableType: {
        type: string;
        waiting: number;
        averageWait: number;
    }[];
}
/**
 * 時段容量實體
 */
export interface ReservationSlot {
    id: string;
    restaurantId: string;
    date: string;
    timeSlot: string;
    maxCapacity: number;
    maxTables: number;
    currentReservations: number;
    currentCapacity: number;
    isAvailable: boolean;
    blockReason?: string;
    createdAt: number;
    updatedAt: number;
}
/**
 * 建立時段請求
 */
export interface CreateSlotRequest {
    restaurantId: string;
    date: string;
    timeSlot: string;
    maxCapacity: number;
    maxTables: number;
    isAvailable?: boolean;
}
/**
 * 更新時段請求
 */
export interface UpdateSlotRequest {
    maxCapacity?: number;
    maxTables?: number;
    isAvailable?: boolean;
    blockReason?: string;
}
/**
 * 批次建立時段請求
 */
export interface BatchCreateSlotsRequest {
    restaurantId: string;
    startDate: string;
    endDate: string;
    timeSlots: string[];
    maxCapacity: number;
    maxTables: number;
}
/**
 * 訂位統計
 */
export interface ReservationStats {
    restaurantId: string;
    date?: string;
    totalReservations: number;
    confirmedCount: number;
    completedCount: number;
    noShowCount: number;
    cancelledCount: number;
    totalGuests: number;
    noShowRate: number;
    averagePartySize: number;
}
/**
 * 候位統計
 */
export interface WaitingStats {
    restaurantId: string;
    date?: string;
    totalWaiting: number;
    seatedCount: number;
    expiredCount: number;
    cancelledCount: number;
    avgWaitMinutes: number;
    expireRate: number;
}
/**
 * 桌位使用率
 */
export interface TableUtilization {
    restaurantId: string;
    totalTables: number;
    availableTables: number;
    occupiedTables: number;
    reservedTables: number;
    cleaningTables: number;
    occupancyRate: number;
}
/**
 * 通知類型
 */
export declare enum NotificationType {
    RESERVATION_CONFIRMED = "reservation_confirmed",
    RESERVATION_REMINDER = "reservation_reminder",
    RESERVATION_CANCELLED = "reservation_cancelled",
    WAITING_CONFIRMED = "waiting_confirmed",
    WAITING_CALLED = "waiting_called",
    WAITING_ABOUT_TO_EXPIRE = "waiting_about_to_expire",
    WAITING_EXPIRED = "waiting_expired"
}
/**
 * 通知請求
 */
export interface NotificationRequest {
    type: NotificationType;
    recipientPhone: string;
    recipientEmail?: string;
    data: any;
}
/**
 * 桌位分配請求
 */
export interface TableAssignmentRequest {
    restaurantId: string;
    partySize: number;
    reservationTime?: string;
    specialRequests?: string;
}
/**
 * 桌位分配結果
 */
export interface TableAssignmentResult {
    tableId: number;
    tableNumber: string;
    confidence: number;
    reason: string;
}
/**
 * 等待時間預估請求
 */
export interface WaitTimeEstimateRequest {
    restaurantId: string;
    partySize: number;
    currentTime?: string;
}
/**
 * 等待時間預估結果
 */
export interface WaitTimeEstimateResult {
    estimatedWaitMinutes: number;
    partiesAhead: number;
    availableTables: number;
    confidence: number;
}
