import { BaseEntity, Status, BusinessHours } from './common';

export interface Restaurant extends BaseEntity {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: BusinessHours;
  logoUrl?: string;
  status: Status;
  planType: PlanType;
  settings?: RestaurantSettings;
}

export enum PlanType {
  FREE = 0,
  BASIC = 1,
  PRO = 2
}

export interface RestaurantSettings {
  currency?: string;
  timezone?: string;
  language?: string;
  autoAcceptOrders?: boolean;
  estimatedPrepTime?: number; // minutes
  maxTablesPerQR?: number;
  enableNotifications?: boolean;
  theme?: {
    primaryColor?: string;
    logoUrl?: string;
    backgroundImage?: string;
  };
}

export interface CreateRestaurantRequest {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: BusinessHours;
}

export interface UpdateRestaurantRequest extends Partial<CreateRestaurantRequest> {
  settings?: Partial<RestaurantSettings>;
}

export interface RestaurantStats {
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number; // in cents
  todayRevenue: number; // in cents
  averageOrderValue: number; // in cents
  activeMenuItems: number;
  totalTables: number;
  occupiedTables: number;
}