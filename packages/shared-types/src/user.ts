import { BaseEntity, Status, UserRole } from "./common";

// Re-export UserRole for convenience
export { UserRole };

/** Preferences stored with a staff user and exposed through the user API. */
export interface UserPreferences {
  language?: string;
  currency?: string;
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
  dietary?: {
    vegetarian?: boolean;
    vegan?: boolean;
    halal?: boolean;
    glutenFree?: boolean;
    allergies?: string[];
  };
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: string;
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
  restaurantId?: string;
  phone?: string;
  address?: string;
}

export interface UpdateUserRequest extends Partial<
  Omit<CreateUserRequest, "password">
> {
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
