/**
 * Partnership Validation Schemas Tests
 * 特約商店驗證模式測試
 */

import { describe, it, expect } from 'vitest'
import {
  createPartnershipSchema,
  updatePartnershipSchema,
  partnershipFiltersSchema,
  createPlanSchema,
  updatePlanSchema,
  planFiltersSchema,
  validatePlanSchema,
  memberVerificationSchema,
  approveMemberSchema,
  rejectMemberSchema,
  updateMemberSchema,
  memberFiltersSchema,
  logUsageSchema,
  usageLogFiltersSchema,
  cancelUsageSchema,
  idParamSchema,
  partnershipIdParamSchema,
  planIdParamSchema,
  memberIdParamSchema,
  paginationSchema,
} from '../schemas/validation'

describe('Partnership Validation Schemas', () => {
  describe('createPartnershipSchema', () => {
    const validPartnership = {
      partnerCode: 'UNIV-001',
      partnerName: 'Test University',
      partnerType: 'university' as const,
      contactPerson: 'John Doe',
      contactPhone: '0912345678',
      contactEmail: 'contact@test.edu',
      contractStartDate: Date.now(),
      contractEndDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    }

    it('should validate valid partnership data', () => {
      const result = createPartnershipSchema.safeParse(validPartnership)
      expect(result.success).toBe(true)
    })

    it('should accept all partner types', () => {
      const types = ['university', 'school', 'corporation', 'government', 'ngo', 'other'] as const
      types.forEach(type => {
        const result = createPartnershipSchema.safeParse({ ...validPartnership, partnerType: type })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid partner type', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, partnerType: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should reject short partner code', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, partnerCode: 'A' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, contactEmail: 'invalid-email' })
      expect(result.success).toBe(false)
    })

    it('should reject short phone number', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, contactPhone: '123' })
      expect(result.success).toBe(false)
    })

    it('should accept optional fields', () => {
      const withOptional = {
        ...validPartnership,
        partnerNameEn: 'Test University English',
        contactTitle: 'Manager',
        address: '123 Test Street',
        contractNumber: 'CONTRACT-001',
        contractDocumentUrl: 'https://example.com/doc.pdf',
        verificationMethod: 'email_domain' as const,
        allowedEmailDomains: ['@test.edu'],
        defaultDiscountType: 'percentage' as const,
        defaultDiscountValue: 10,
        logoUrl: 'https://example.com/logo.png',
        description: 'Test description',
        notes: 'Test notes',
        tags: ['education', 'partner'],
        metadata: { custom: 'data' },
      }
      const result = createPartnershipSchema.safeParse(withOptional)
      expect(result.success).toBe(true)
    })

    it('should accept all verification methods', () => {
      const methods = ['manual', 'email_domain', 'id_card', 'qr_code', 'api'] as const
      methods.forEach(method => {
        const result = createPartnershipSchema.safeParse({ ...validPartnership, verificationMethod: method })
        expect(result.success).toBe(true)
      })
    })

    it('should reject negative discount value', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, defaultDiscountValue: -10 })
      expect(result.success).toBe(false)
    })

    it('should reject invalid URL for logoUrl', () => {
      const result = createPartnershipSchema.safeParse({ ...validPartnership, logoUrl: 'not-a-url' })
      expect(result.success).toBe(false)
    })
  })

  describe('updatePartnershipSchema', () => {
    it('should allow partial updates', () => {
      const result = updatePartnershipSchema.safeParse({ contactPhone: '0987654321' })
      expect(result.success).toBe(true)
    })

    it('should allow empty object', () => {
      const result = updatePartnershipSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should validate fields when provided', () => {
      const result = updatePartnershipSchema.safeParse({ contactEmail: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('partnershipFiltersSchema', () => {
    it('should parse valid filters', () => {
      const result = partnershipFiltersSchema.safeParse({
        partnerType: 'university',
        status: 'active',
        page: '1',
        limit: '20',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
      }
    })

    it('should transform isActive string to boolean', () => {
      const result = partnershipFiltersSchema.safeParse({ isActive: 'true' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should use default pagination values', () => {
      const result = partnershipFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
      }
    })

    it('should accept all status values', () => {
      const statuses = ['draft', 'active', 'suspended', 'expired', 'terminated'] as const
      statuses.forEach(status => {
        const result = partnershipFiltersSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })
  })
})

describe('Plan Validation Schemas', () => {
  describe('createPlanSchema', () => {
    const validPlan = {
      partnershipId: '550e8400-e29b-41d4-a716-446655440000',
      restaurantId: 'rest-001',
      planCode: 'PLAN-001',
      planName: 'Student Discount',
      discountType: 'percentage' as const,
      discountValue: 15,
      validFrom: Date.now(),
      validTo: Date.now() + 180 * 24 * 60 * 60 * 1000,
    }

    it('should validate valid plan data', () => {
      const result = createPlanSchema.safeParse(validPlan)
      expect(result.success).toBe(true)
    })

    it('should accept all discount types', () => {
      const types = ['percentage', 'fixed', 'special_price'] as const
      types.forEach(type => {
        const result = createPlanSchema.safeParse({ ...validPlan, discountType: type })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid UUID for partnershipId', () => {
      const result = createPlanSchema.safeParse({ ...validPlan, partnershipId: 'invalid-uuid' })
      expect(result.success).toBe(false)
    })

    it('should accept optional fields', () => {
      const withOptional = {
        ...validPlan,
        planNameEn: 'Student Discount English',
        description: 'Discount for students',
        maxDiscountAmount: 100,
        minOrderAmount: 50,
        maxOrderAmount: 1000,
        applicableMenuItems: ['item-1', 'item-2'],
        applicableCategories: ['cat-1'],
        excludedMenuItems: ['item-3'],
        excludedCategories: ['cat-2'],
        applicableDays: [1, 2, 3, 4, 5],
        applicableTimeSlots: [{ start: '11:00', end: '14:00' }],
        usageLimitPerMember: 10,
        usageLimitPerDay: 2,
        priority: 1,
        canCombineWithCoupons: true,
        canCombineWithPromotions: false,
        badgeText: '學生優惠',
        badgeColor: '#FF5733',
        showOnMenu: true,
        termsAndConditions: 'Terms apply',
        notes: 'Internal notes',
        metadata: { custom: 'data' },
      }
      const result = createPlanSchema.safeParse(withOptional)
      expect(result.success).toBe(true)
    })

    it('should validate time slot format', () => {
      const validTimeSlot = { ...validPlan, applicableTimeSlots: [{ start: '09:00', end: '17:30' }] }
      expect(createPlanSchema.safeParse(validTimeSlot).success).toBe(true)

      const invalidTimeSlot = { ...validPlan, applicableTimeSlots: [{ start: '9:00', end: '17:30' }] }
      expect(createPlanSchema.safeParse(invalidTimeSlot).success).toBe(false)
    })

    it('should validate applicable days range', () => {
      const validDays = { ...validPlan, applicableDays: [0, 1, 2, 3, 4, 5, 6] }
      expect(createPlanSchema.safeParse(validDays).success).toBe(true)

      const invalidDays = { ...validPlan, applicableDays: [7] }
      expect(createPlanSchema.safeParse(invalidDays).success).toBe(false)
    })

    it('should reject negative discount value', () => {
      const result = createPlanSchema.safeParse({ ...validPlan, discountValue: -5 })
      expect(result.success).toBe(false)
    })
  })

  describe('updatePlanSchema', () => {
    it('should allow partial updates', () => {
      const result = updatePlanSchema.safeParse({ discountValue: 20 })
      expect(result.success).toBe(true)
    })

    it('should not allow partnershipId update', () => {
      const result = updatePlanSchema.safeParse({ partnershipId: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('partnershipId')
      }
    })
  })

  describe('planFiltersSchema', () => {
    it('should parse valid filters', () => {
      const result = planFiltersSchema.safeParse({
        partnershipId: '550e8400-e29b-41d4-a716-446655440000',
        restaurantId: 'rest-001',
        isActive: 'true',
        validOnly: 'true',
      })
      expect(result.success).toBe(true)
    })

    it('should transform boolean strings', () => {
      const result = planFiltersSchema.safeParse({ isActive: 'true', validOnly: 'false' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
        expect(result.data.validOnly).toBe(false)
      }
    })
  })

  describe('validatePlanSchema', () => {
    it('should validate plan validation request', () => {
      const result = validatePlanSchema.safeParse({
        planId: '550e8400-e29b-41d4-a716-446655440000',
        memberId: '550e8400-e29b-41d4-a716-446655440001',
        orderAmount: 200,
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-positive order amount', () => {
      const result = validatePlanSchema.safeParse({
        planId: '550e8400-e29b-41d4-a716-446655440000',
        memberId: '550e8400-e29b-41d4-a716-446655440001',
        orderAmount: 0,
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional menu items and categories', () => {
      const result = validatePlanSchema.safeParse({
        planId: '550e8400-e29b-41d4-a716-446655440000',
        memberId: '550e8400-e29b-41d4-a716-446655440001',
        orderAmount: 200,
        menuItems: ['item-1', 'item-2'],
        categories: ['cat-1'],
      })
      expect(result.success).toBe(true)
    })
  })
})


describe('Member Validation Schemas', () => {
  describe('memberVerificationSchema', () => {
    const validVerification = {
      partnershipId: '550e8400-e29b-41d4-a716-446655440000',
      memberId: 'B10812345',
      memberType: 'student' as const,
      fullName: 'Test Student',
      verificationMethod: 'email_domain' as const,
    }

    it('should validate valid verification data', () => {
      const result = memberVerificationSchema.safeParse(validVerification)
      expect(result.success).toBe(true)
    })

    it('should accept all member types', () => {
      const types = ['student', 'employee', 'faculty', 'alumni', 'staff', 'other'] as const
      types.forEach(type => {
        const result = memberVerificationSchema.safeParse({ ...validVerification, memberType: type })
        expect(result.success).toBe(true)
      })
    })

    it('should accept optional fields', () => {
      const withOptional = {
        ...validVerification,
        email: 'student@test.edu',
        phone: '0912345678',
        verificationDocumentUrl: 'https://example.com/doc.pdf',
        department: 'Computer Science',
        gradeOrPosition: 'Senior',
        studentIdPhotoUrl: 'https://example.com/photo.jpg',
      }
      const result = memberVerificationSchema.safeParse(withOptional)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = memberVerificationSchema.safeParse({ ...validVerification, email: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should reject short member ID', () => {
      const result = memberVerificationSchema.safeParse({ ...validVerification, memberId: 'A' })
      expect(result.success).toBe(false)
    })

    it('should reject short full name', () => {
      const result = memberVerificationSchema.safeParse({ ...validVerification, fullName: 'A' })
      expect(result.success).toBe(false)
    })
  })

  describe('approveMemberSchema', () => {
    it('should accept empty object', () => {
      const result = approveMemberSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept verification expiry', () => {
      const result = approveMemberSchema.safeParse({
        verificationExpiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
      })
      expect(result.success).toBe(true)
    })

    it('should reject non-positive expiry', () => {
      const result = approveMemberSchema.safeParse({ verificationExpiry: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('rejectMemberSchema', () => {
    it('should validate rejection reason', () => {
      const result = rejectMemberSchema.safeParse({
        rejectionReason: 'Invalid student ID photo - please resubmit',
      })
      expect(result.success).toBe(true)
    })

    it('should reject short reason', () => {
      const result = rejectMemberSchema.safeParse({ rejectionReason: 'No' })
      expect(result.success).toBe(false)
    })

    it('should reject missing reason', () => {
      const result = rejectMemberSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('updateMemberSchema', () => {
    it('should allow partial updates', () => {
      const result = updateMemberSchema.safeParse({ email: 'new@test.edu' })
      expect(result.success).toBe(true)
    })

    it('should allow empty object', () => {
      const result = updateMemberSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should validate email when provided', () => {
      const result = updateMemberSchema.safeParse({ email: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('memberFiltersSchema', () => {
    it('should parse valid filters', () => {
      const result = memberFiltersSchema.safeParse({
        partnershipId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'verified',
        memberType: 'student',
        search: 'test',
        verifiedOnly: 'true',
      })
      expect(result.success).toBe(true)
    })

    it('should accept all status values', () => {
      const statuses = ['pending', 'verified', 'rejected', 'expired', 'suspended'] as const
      statuses.forEach(status => {
        const result = memberFiltersSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })
  })
})

describe('Usage Log Validation Schemas', () => {
  describe('logUsageSchema', () => {
    const validUsage = {
      partnershipId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      memberId: '550e8400-e29b-41d4-a716-446655440002',
      orderId: '550e8400-e29b-41d4-a716-446655440003',
      restaurantId: 'rest-001',
      discountType: 'percentage',
      discountValue: 15,
      discountAmount: 30,
      originalAmount: 200,
      finalAmount: 170,
    }

    it('should validate valid usage data', () => {
      const result = logUsageSchema.safeParse(validUsage)
      expect(result.success).toBe(true)
    })

    it('should accept optional fields', () => {
      const withOptional = {
        ...validUsage,
        orderItems: [{ id: 'item-1', quantity: 2 }],
        channel: 'dine_in' as const,
        verificationMethod: 'qr_code',
        verifiedByUserId: '550e8400-e29b-41d4-a716-446655440004',
        metadata: { custom: 'data' },
      }
      const result = logUsageSchema.safeParse(withOptional)
      expect(result.success).toBe(true)
    })

    it('should accept all channel types', () => {
      const channels = ['dine_in', 'takeaway', 'delivery', 'online'] as const
      channels.forEach(channel => {
        const result = logUsageSchema.safeParse({ ...validUsage, channel })
        expect(result.success).toBe(true)
      })
    })

    it('should reject negative amounts', () => {
      expect(logUsageSchema.safeParse({ ...validUsage, discountAmount: -10 }).success).toBe(false)
      expect(logUsageSchema.safeParse({ ...validUsage, originalAmount: -100 }).success).toBe(false)
      expect(logUsageSchema.safeParse({ ...validUsage, finalAmount: -50 }).success).toBe(false)
    })
  })

  describe('usageLogFiltersSchema', () => {
    it('should parse valid filters', () => {
      const result = usageLogFiltersSchema.safeParse({
        partnershipId: '550e8400-e29b-41d4-a716-446655440000',
        planId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      })
      expect(result.success).toBe(true)
    })

    it('should transform date strings to timestamps', () => {
      const result = usageLogFiltersSchema.safeParse({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.data.startDate).toBe('number')
        expect(typeof result.data.endDate).toBe('number')
      }
    })

    it('should accept all status values', () => {
      const statuses = ['pending', 'completed', 'cancelled', 'refunded'] as const
      statuses.forEach(status => {
        const result = usageLogFiltersSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('cancelUsageSchema', () => {
    it('should validate cancellation reason', () => {
      const result = cancelUsageSchema.safeParse({
        reason: 'Customer requested cancellation',
      })
      expect(result.success).toBe(true)
    })

    it('should reject short reason', () => {
      const result = cancelUsageSchema.safeParse({ reason: 'No' })
      expect(result.success).toBe(false)
    })
  })
})

describe('Common Validation Schemas', () => {
  describe('idParamSchema', () => {
    it('should validate valid UUID', () => {
      const result = idParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const result = idParamSchema.safeParse({ id: 'invalid-uuid' })
      expect(result.success).toBe(false)
    })
  })

  describe('partnershipIdParamSchema', () => {
    it('should validate valid UUID', () => {
      const result = partnershipIdParamSchema.safeParse({
        partnershipId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('planIdParamSchema', () => {
    it('should validate valid UUID', () => {
      const result = planIdParamSchema.safeParse({
        planId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('memberIdParamSchema', () => {
    it('should validate valid UUID', () => {
      const result = memberIdParamSchema.safeParse({
        memberId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('paginationSchema', () => {
    it('should parse pagination params', () => {
      const result = paginationSchema.safeParse({ page: '2', limit: '50' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should use default values', () => {
      const result = paginationSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
      }
    })
  })
})
