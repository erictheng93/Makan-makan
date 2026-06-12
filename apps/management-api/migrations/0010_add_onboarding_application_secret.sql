-- Store only a hash of the one-time secret required to resume onboarding.
ALTER TABLE onboarding_applications
ADD COLUMN application_secret_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_onboarding_applications_secret
ON onboarding_applications(id, application_secret_hash);
