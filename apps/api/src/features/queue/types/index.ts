/**
 * Queue Feature Types
 */

export interface JoinQueueRequest {
  restaurantId: string;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  specialRequests?: string;
}

export interface CallNextRequest {
  restaurantId: string;
  tableId?: number;
  specificQueueId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
