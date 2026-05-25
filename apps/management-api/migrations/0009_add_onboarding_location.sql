-- Migration: Add restaurant location capture to onboarding
-- Description: Stores GPS coordinates collected during onboarding for market discovery.

ALTER TABLE onboarding_applications ADD COLUMN latitude REAL;
ALTER TABLE onboarding_applications ADD COLUMN longitude REAL;

ALTER TABLE tenants ADD COLUMN latitude REAL;
ALTER TABLE tenants ADD COLUMN longitude REAL;
