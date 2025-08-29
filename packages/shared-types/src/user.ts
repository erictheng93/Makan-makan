import { BaseEntity, Status, UserRole } from './common';

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: number;
  phone?: string;
  address?: string;
  status: Status;
  lastLogin?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  restaurantId?: number;
  phone?: string;
  address?: string;
}

export interface UpdateUserRequest extends Partial<Omit<CreateUserRequest, 'password'>> {
  currentPassword?: string;
  newPassword?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ConfirmResetPasswordRequest {
  token: string;
  newPassword: string;
}