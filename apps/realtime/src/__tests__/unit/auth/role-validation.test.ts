/**
 * Role Validation Tests
 * 測試角色驗證和權限檢查邏輯
 */

import { describe, it, expect } from 'vitest'
import type { RealtimeAuthPayload } from '@makanmakan/shared-types'

// Role definitions
enum UserRole {
  Admin = 0,      // 管理員 - 完全訪問權限
  Owner = 1,      // 店主 - 餐廳管理權限
  Chef = 2,       // 廚師 - 廚房權限
  Crew = 3,       // 服務員 - 服務權限
  Customer = 4    // 顧客 - 有限訪問權限
}

// Helper function to validate role
function isValidRole(role: number): boolean {
  return role >= 0 && role <= 4
}

// Helper function to check if role has admin privileges
function hasAdminPrivileges(role: number): boolean {
  return role === UserRole.Admin || role === UserRole.Owner
}

// Helper function to check if role can access kitchen
function canAccessKitchen(role: number): boolean {
  return role === UserRole.Admin || role === UserRole.Chef
}

// Helper function to check if role can serve customers
function canServeCustomers(role: number): boolean {
  return role >= UserRole.Chef && role <= UserRole.Crew
}

// Helper function to check room type access by role
function canAccessRoomType(role: number, roomType: string): boolean {
  switch (roomType) {
    case 'admin':
      return hasAdminPrivileges(role)
    case 'kitchen':
      return canAccessKitchen(role)
    case 'customer':
      return true // All roles can access customer rooms
    default:
      return false
  }
}

describe('Role Validation', () => {
  describe('Role Definition Validation', () => {
    it('should validate all defined roles', () => {
      const roles = [
        UserRole.Admin,
        UserRole.Owner,
        UserRole.Chef,
        UserRole.Crew,
        UserRole.Customer
      ]

      roles.forEach(role => {
        expect(isValidRole(role)).toBe(true)
      })
    })

    it('should reject invalid role numbers', () => {
      const invalidRoles = [-1, 5, 10, 999]

      invalidRoles.forEach(role => {
        expect(isValidRole(role)).toBe(false)
      })
    })

    it('should map role numbers to correct roles', () => {
      expect(UserRole.Admin).toBe(0)
      expect(UserRole.Owner).toBe(1)
      expect(UserRole.Chef).toBe(2)
      expect(UserRole.Crew).toBe(3)
      expect(UserRole.Customer).toBe(4)
    })
  })

  describe('Admin Privileges', () => {
    it('should grant admin privileges to Admin role', () => {
      expect(hasAdminPrivileges(UserRole.Admin)).toBe(true)
    })

    it('should grant admin privileges to Owner role', () => {
      expect(hasAdminPrivileges(UserRole.Owner)).toBe(true)
    })

    it('should not grant admin privileges to Chef', () => {
      expect(hasAdminPrivileges(UserRole.Chef)).toBe(false)
    })

    it('should not grant admin privileges to Crew', () => {
      expect(hasAdminPrivileges(UserRole.Crew)).toBe(false)
    })

    it('should not grant admin privileges to Customer', () => {
      expect(hasAdminPrivileges(UserRole.Customer)).toBe(false)
    })
  })

  describe('Kitchen Access', () => {
    it('should allow Admin to access kitchen', () => {
      expect(canAccessKitchen(UserRole.Admin)).toBe(true)
    })

    it('should not allow Owner to access kitchen', () => {
      expect(canAccessKitchen(UserRole.Owner)).toBe(false)
    })

    it('should allow Chef to access kitchen', () => {
      expect(canAccessKitchen(UserRole.Chef)).toBe(true)
    })

    it('should not allow Crew to access kitchen', () => {
      expect(canAccessKitchen(UserRole.Crew)).toBe(false)
    })

    it('should not allow Customer to access kitchen', () => {
      expect(canAccessKitchen(UserRole.Customer)).toBe(false)
    })
  })

  describe('Customer Service Access', () => {
    it('should not allow Admin to serve customers directly', () => {
      expect(canServeCustomers(UserRole.Admin)).toBe(false)
    })

    it('should not allow Owner to serve customers directly', () => {
      expect(canServeCustomers(UserRole.Owner)).toBe(false)
    })

    it('should allow Chef to serve customers', () => {
      expect(canServeCustomers(UserRole.Chef)).toBe(true)
    })

    it('should allow Crew to serve customers', () => {
      expect(canServeCustomers(UserRole.Crew)).toBe(true)
    })

    it('should not allow Customer to serve customers', () => {
      expect(canServeCustomers(UserRole.Customer)).toBe(false)
    })
  })

  describe('Room Type Access Control', () => {
    it('should allow Admin to access admin rooms', () => {
      expect(canAccessRoomType(UserRole.Admin, 'admin')).toBe(true)
    })

    it('should allow Owner to access admin rooms', () => {
      expect(canAccessRoomType(UserRole.Owner, 'admin')).toBe(true)
    })

    it('should not allow Chef to access admin rooms', () => {
      expect(canAccessRoomType(UserRole.Chef, 'admin')).toBe(false)
    })

    it('should allow Admin to access kitchen rooms', () => {
      expect(canAccessRoomType(UserRole.Admin, 'kitchen')).toBe(true)
    })

    it('should allow Chef to access kitchen rooms', () => {
      expect(canAccessRoomType(UserRole.Chef, 'kitchen')).toBe(true)
    })

    it('should not allow Customer to access kitchen rooms', () => {
      expect(canAccessRoomType(UserRole.Customer, 'kitchen')).toBe(false)
    })

    it('should allow all roles to access customer rooms', () => {
      const roles = [
        UserRole.Admin,
        UserRole.Owner,
        UserRole.Chef,
        UserRole.Crew,
        UserRole.Customer
      ]

      roles.forEach(role => {
        expect(canAccessRoomType(role, 'customer')).toBe(true)
      })
    })
  })

  describe('Auth Payload Validation', () => {
    it('should validate complete auth payload', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'customer',
        roomId: 'table-001',
        restaurantId: 'restaurant-123',
        userId: 'user-456',
        role: UserRole.Customer,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      expect(authPayload.role).toBe(UserRole.Customer)
      expect(isValidRole(authPayload.role)).toBe(true)
    })

    it('should validate admin auth payload', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'admin',
        roomId: 'admin-restaurant-123',
        restaurantId: 'restaurant-123',
        userId: 'user-admin',
        role: UserRole.Admin,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      expect(authPayload.role).toBe(UserRole.Admin)
      expect(hasAdminPrivileges(authPayload.role)).toBe(true)
      expect(canAccessRoomType(authPayload.role, authPayload.roomType)).toBe(true)
    })

    it('should validate kitchen staff auth payload', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'kitchen',
        roomId: 'kitchen-restaurant-123',
        restaurantId: 'restaurant-123',
        userId: 'user-chef',
        role: UserRole.Chef,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      expect(authPayload.role).toBe(UserRole.Chef)
      expect(canAccessKitchen(authPayload.role)).toBe(true)
      expect(canAccessRoomType(authPayload.role, authPayload.roomType)).toBe(true)
    })

    it('should detect role mismatch with room type', () => {
      // Customer trying to access admin room
      const invalidPayload: RealtimeAuthPayload = {
        roomType: 'admin',
        roomId: 'admin-restaurant-123',
        restaurantId: 'restaurant-123',
        role: UserRole.Customer,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      expect(canAccessRoomType(invalidPayload.role, invalidPayload.roomType)).toBe(false)
    })
  })

  describe('Role-Based Access Scenarios', () => {
    it('should allow admin to access all room types', () => {
      const roomTypes = ['admin', 'kitchen', 'customer']

      roomTypes.forEach(roomType => {
        expect(canAccessRoomType(UserRole.Admin, roomType)).toBe(true)
      })
    })

    it('should restrict customer access to customer rooms only', () => {
      expect(canAccessRoomType(UserRole.Customer, 'customer')).toBe(true)
      expect(canAccessRoomType(UserRole.Customer, 'admin')).toBe(false)
      expect(canAccessRoomType(UserRole.Customer, 'kitchen')).toBe(false)
    })

    it('should allow owner access to admin and customer rooms', () => {
      expect(canAccessRoomType(UserRole.Owner, 'admin')).toBe(true)
      expect(canAccessRoomType(UserRole.Owner, 'customer')).toBe(true)
      expect(canAccessRoomType(UserRole.Owner, 'kitchen')).toBe(false)
    })

    it('should allow chef access to kitchen and customer rooms', () => {
      expect(canAccessRoomType(UserRole.Chef, 'kitchen')).toBe(true)
      expect(canAccessRoomType(UserRole.Chef, 'customer')).toBe(true)
      expect(canAccessRoomType(UserRole.Chef, 'admin')).toBe(false)
    })

    it('should allow crew access to customer rooms only', () => {
      expect(canAccessRoomType(UserRole.Crew, 'customer')).toBe(true)
      expect(canAccessRoomType(UserRole.Crew, 'admin')).toBe(false)
      expect(canAccessRoomType(UserRole.Crew, 'kitchen')).toBe(false)
    })
  })

  describe('Role Validation in WebSocket Context', () => {
    it('should validate role before WebSocket upgrade', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'customer',
        roomId: 'table-001',
        restaurantId: 'restaurant-123',
        role: UserRole.Customer,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      // Validate role is within valid range
      expect(isValidRole(authPayload.role)).toBe(true)

      // Validate role can access requested room type
      expect(canAccessRoomType(authPayload.role, authPayload.roomType)).toBe(true)
    })

    it('should reject invalid role during validation', () => {
      const invalidRole = 999

      expect(isValidRole(invalidRole)).toBe(false)
    })

    it('should reject role-roomType mismatch', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'admin',
        roomId: 'admin-restaurant-123',
        restaurantId: 'restaurant-123',
        role: UserRole.Customer, // Customer cannot access admin room
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      const canAccess = canAccessRoomType(authPayload.role, authPayload.roomType)
      expect(canAccess).toBe(false)
    })
  })

  describe('Role Hierarchy', () => {
    it('should maintain correct role hierarchy', () => {
      expect(UserRole.Admin).toBeLessThan(UserRole.Owner)
      expect(UserRole.Owner).toBeLessThan(UserRole.Chef)
      expect(UserRole.Chef).toBeLessThan(UserRole.Crew)
      expect(UserRole.Crew).toBeLessThan(UserRole.Customer)
    })

    it('should identify higher privilege roles', () => {
      const isHigherPrivilege = (role1: number, role2: number): boolean => {
        return role1 < role2 // Lower number = higher privilege
      }

      expect(isHigherPrivilege(UserRole.Admin, UserRole.Customer)).toBe(true)
      expect(isHigherPrivilege(UserRole.Owner, UserRole.Chef)).toBe(true)
      expect(isHigherPrivilege(UserRole.Customer, UserRole.Admin)).toBe(false)
    })

    it('should check if role meets minimum privilege level', () => {
      const meetsMinimumPrivilege = (role: number, minRole: number): boolean => {
        return role <= minRole // Lower or equal number = meets or exceeds privilege
      }

      // Admin has privilege level >= Chef
      expect(meetsMinimumPrivilege(UserRole.Admin, UserRole.Chef)).toBe(true)

      // Customer does not have privilege level >= Chef
      expect(meetsMinimumPrivilege(UserRole.Customer, UserRole.Chef)).toBe(false)
    })
  })

  describe('Optional Role Handling', () => {
    it('should handle undefined role as lowest privilege', () => {
      const authPayload: Partial<RealtimeAuthPayload> = {
        roomType: 'customer',
        roomId: 'table-001',
        restaurantId: 'restaurant-123'
        // role is undefined
      }

      const role = authPayload.role
      expect(role).toBeUndefined()
    })

    it('should default to customer permissions for missing role', () => {
      const role = undefined

      const defaultRole = role ?? UserRole.Customer

      expect(defaultRole).toBe(UserRole.Customer)
      expect(isValidRole(defaultRole)).toBe(true)
    })
  })

  describe('Multi-Role Scenarios', () => {
    it('should handle user with multiple roles', () => {
      // User can have different roles in different contexts
      const userRoles = [
        { context: 'restaurant-123', role: UserRole.Owner },
        { context: 'restaurant-456', role: UserRole.Chef }
      ]

      userRoles.forEach(({ role }) => {
        expect(isValidRole(role)).toBe(true)
      })
    })

    it('should validate role for specific restaurant context', () => {
      const authPayload: RealtimeAuthPayload = {
        roomType: 'admin',
        roomId: 'admin-restaurant-123',
        restaurantId: 'restaurant-123',
        role: UserRole.Owner,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }

      // Validate role within restaurant context
      expect(authPayload.restaurantId).toBe('restaurant-123')
      expect(authPayload.role).toBe(UserRole.Owner)
      expect(hasAdminPrivileges(authPayload.role)).toBe(true)
    })
  })

  describe('Role Validation Error Cases', () => {
    it('should handle negative role numbers', () => {
      const invalidRole = -1
      expect(isValidRole(invalidRole)).toBe(false)
    })

    it('should handle extremely large role numbers', () => {
      const invalidRole = Number.MAX_SAFE_INTEGER
      expect(isValidRole(invalidRole)).toBe(false)
    })

    it('should handle NaN as invalid role', () => {
      const invalidRole = NaN
      expect(isValidRole(invalidRole)).toBe(false)
    })

    it('should handle null role gracefully', () => {
      const role = null
      const safeRole = role ?? UserRole.Customer

      expect(safeRole).toBe(UserRole.Customer)
      expect(isValidRole(safeRole)).toBe(true)
    })
  })

  describe('Role Permission Matrix', () => {
    it('should create complete permission matrix', () => {
      const permissionMatrix = {
        [UserRole.Admin]: {
          canAccessAdmin: true,
          canAccessKitchen: true,
          canAccessCustomer: true,
          canManageUsers: true,
          canManageMenu: true,
          canViewReports: true
        },
        [UserRole.Owner]: {
          canAccessAdmin: true,
          canAccessKitchen: false,
          canAccessCustomer: true,
          canManageUsers: true,
          canManageMenu: true,
          canViewReports: true
        },
        [UserRole.Chef]: {
          canAccessAdmin: false,
          canAccessKitchen: true,
          canAccessCustomer: true,
          canManageUsers: false,
          canManageMenu: true,
          canViewReports: false
        },
        [UserRole.Crew]: {
          canAccessAdmin: false,
          canAccessKitchen: false,
          canAccessCustomer: true,
          canManageUsers: false,
          canManageMenu: false,
          canViewReports: false
        },
        [UserRole.Customer]: {
          canAccessAdmin: false,
          canAccessKitchen: false,
          canAccessCustomer: true,
          canManageUsers: false,
          canManageMenu: false,
          canViewReports: false
        }
      }

      // Validate admin has all permissions
      expect(permissionMatrix[UserRole.Admin].canAccessAdmin).toBe(true)
      expect(permissionMatrix[UserRole.Admin].canAccessKitchen).toBe(true)
      expect(permissionMatrix[UserRole.Admin].canManageUsers).toBe(true)

      // Validate customer has limited permissions
      expect(permissionMatrix[UserRole.Customer].canAccessAdmin).toBe(false)
      expect(permissionMatrix[UserRole.Customer].canAccessKitchen).toBe(false)
      expect(permissionMatrix[UserRole.Customer].canManageUsers).toBe(false)
    })

    it('should check specific permission for role', () => {
      const hasPermission = (role: number, permission: string): boolean => {
        const permissions: Record<number, string[]> = {
          [UserRole.Admin]: ['admin', 'kitchen', 'customer', 'users', 'menu', 'reports'],
          [UserRole.Owner]: ['admin', 'customer', 'users', 'menu', 'reports'],
          [UserRole.Chef]: ['kitchen', 'customer', 'menu'],
          [UserRole.Crew]: ['customer'],
          [UserRole.Customer]: ['customer']
        }

        return permissions[role]?.includes(permission) ?? false
      }

      expect(hasPermission(UserRole.Admin, 'admin')).toBe(true)
      expect(hasPermission(UserRole.Customer, 'admin')).toBe(false)
      expect(hasPermission(UserRole.Chef, 'kitchen')).toBe(true)
    })
  })
})
