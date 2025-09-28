import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { UsersService } from '../services/UsersService'
import { USER_ROLES } from '@makanmakan/database'

// Mock environment for testing
const mockEnv = {
  DB: {} // Mock database connection
} as any

describe('Users Feature Module', () => {
  let usersService: UsersService

  beforeEach(() => {
    usersService = new UsersService(mockEnv)
  })

  afterEach(() => {
    // Cleanup if needed
  })

  describe('UsersService', () => {
    describe('canManageUser', () => {
      test('admin can manage all users', () => {
        const adminUser = { role: USER_ROLES.ADMIN, restaurantId: 1 }

        expect(usersService.canManageUser(adminUser, USER_ROLES.OWNER, 2)).toBe(true)
        expect(usersService.canManageUser(adminUser, USER_ROLES.CHEF, 2)).toBe(true)
        expect(usersService.canManageUser(adminUser, USER_ROLES.CUSTOMER, 2)).toBe(true)
      })

      test('owner can only manage restaurant staff', () => {
        const ownerUser = { role: USER_ROLES.OWNER, restaurantId: 1 }

        // Can manage staff in same restaurant
        expect(usersService.canManageUser(ownerUser, USER_ROLES.CHEF, 1)).toBe(true)
        expect(usersService.canManageUser(ownerUser, USER_ROLES.SERVICE, 1)).toBe(true)
        expect(usersService.canManageUser(ownerUser, USER_ROLES.CASHIER, 1)).toBe(true)
        expect(usersService.canManageUser(ownerUser, USER_ROLES.CUSTOMER, 1)).toBe(true)

        // Cannot manage other owners or admins
        expect(usersService.canManageUser(ownerUser, USER_ROLES.ADMIN, 1)).toBe(false)
        expect(usersService.canManageUser(ownerUser, USER_ROLES.OWNER, 1)).toBe(false)

        // Cannot manage staff in different restaurant
        expect(usersService.canManageUser(ownerUser, USER_ROLES.CHEF, 2)).toBe(false)
      })

      test('other roles cannot manage users', () => {
        const chefUser = { role: USER_ROLES.CHEF, restaurantId: 1 }

        expect(usersService.canManageUser(chefUser, USER_ROLES.CHEF, 1)).toBe(false)
        expect(usersService.canManageUser(chefUser, USER_ROLES.CUSTOMER, 1)).toBe(false)
      })
    })

    describe('canViewUser', () => {
      test('admin can view all users', () => {
        const adminUser = { role: USER_ROLES.ADMIN, id: 1, restaurantId: 1 }
        const targetUser = { id: 2, restaurantId: 2 }

        expect(usersService.canViewUser(adminUser, targetUser)).toBe(true)
      })

      test('user can view themselves', () => {
        const user = { role: USER_ROLES.CHEF, id: 1, restaurantId: 1 }
        const sameUser = { id: 1, restaurantId: 1 }

        expect(usersService.canViewUser(user, sameUser)).toBe(true)
      })

      test('owner can view restaurant staff', () => {
        const ownerUser = { role: USER_ROLES.OWNER, id: 1, restaurantId: 1 }
        const staffUser = { id: 2, restaurantId: 1 }
        const otherRestaurantUser = { id: 3, restaurantId: 2 }

        expect(usersService.canViewUser(ownerUser, staffUser)).toBe(true)
        expect(usersService.canViewUser(ownerUser, otherRestaurantUser)).toBe(false)
      })
    })

    describe('formatUser', () => {
      test('formats user data correctly', () => {
        const rawUser = {
          id: 1,
          username: 'testuser',
          role: USER_ROLES.CHEF,
          restaurantId: 1,
          email: 'test@example.com',
          fullName: 'Test User',
          phone: '+1234567890',
          address: '123 Test St',
          dateOfBirth: '1990-01-01',
          profileImageUrl: 'https://example.com/avatar.jpg',
          isActive: true,
          isVerified: true,
          preferences: { theme: 'dark' },
          totalOrders: 10,
          totalSpent: 250.50,
          lastLoginAt: '2023-01-01T00:00:00Z',
          createdAt: '2022-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }

        const formatted = usersService.formatUser(rawUser)

        expect(formatted).toMatchObject({
          id: 1,
          username: 'testuser',
          role: USER_ROLES.CHEF,
          role_name: 'Chef',
          restaurantId: 1,
          email: 'test@example.com',
          fullName: 'Test User',
          phone: '+1234567890',
          address: '123 Test St',
          dateOfBirth: '1990-01-01',
          profileImageUrl: 'https://example.com/avatar.jpg',
          isActive: true,
          isVerified: true,
          preferences: { theme: 'dark' },
          totalOrders: 10,
          totalSpent: 250.50,
          lastLoginAt: '2023-01-01T00:00:00Z',
          createdAt: '2022-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        })
      })

      test('handles unknown roles gracefully', () => {
        const rawUser = {
          id: 1,
          username: 'testuser',
          role: 999, // Unknown role
          fullName: 'Test User',
          isActive: true,
          isVerified: false,
          createdAt: '2022-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }

        const formatted = usersService.formatUser(rawUser)

        expect(formatted.role_name).toBe('Unknown')
      })
    })
  })

  describe('Permission Validation', () => {
    test('role hierarchy is correctly enforced', () => {
      const roles = [
        USER_ROLES.ADMIN,
        USER_ROLES.OWNER,
        USER_ROLES.CHEF,
        USER_ROLES.SERVICE,
        USER_ROLES.CASHIER,
        USER_ROLES.CUSTOMER
      ]

      expect(roles).toEqual([0, 1, 2, 3, 4, 5])
    })
  })
})