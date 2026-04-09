# OrderStatus Surface Audit

**Date:** 2026-04-09
**Related issue:** #9
**Status:** In progress

## Summary

(Filled in at end of Phase 0)

## 1. Type Definitions Inventory

### 1.1 packages/shared-types/src/order.ts
### 1.2 packages/database/src/schema/orders.ts
### 1.3 apps/realtime/src/advanced-realtime-session.ts

## 2. File-Level Reference Inventory

### 2.1 apps/api
### 2.2 apps/realtime
### 2.3 apps/customer-app
### 2.4 apps/kitchen-display
### 2.5 apps/admin-dashboard
### 2.6 apps/management-portal
### 2.7 apps/onboarding-app
### 2.8 packages/testing-utils
### 2.9 packages/shared-types
### 2.10 packages/database
### 2.11 tests/e2e

## 3. Hardcoded Numeric Literal Sites

## 4. Runtime `typeof status === "number"` Guards

## 5. Dead Code

## 6. Bidirectional Mapping Surface

### 6.1 OrdersService.normalizeStatus
### 6.2 OrdersService.getAllowedStatusTransitions — caller audit

## 7. External Wire Consumers

## 8. Durable Object Hibernated State

## 9. Client-Side Caches

### 9.1 kitchen-display localStorage
### 9.2 Browser bundle caching

## 10. Canonical State Decision (for Phase 0.5)

## 11. Migration Risk Register
