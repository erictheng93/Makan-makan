export const CUSTOMER_CONSENT_TYPES = [
  "marketing",
  "analytics",
  "location",
  "data_share",
  "terms_of_service",
  "privacy_policy",
] as const;

export type CustomerConsentType = (typeof CUSTOMER_CONSENT_TYPES)[number];

export const CUSTOMER_CONSENT_VERSIONS: Record<CustomerConsentType, string> = {
  marketing: "2026-05-25-v1",
  analytics: "2026-05-25-v1",
  location: "2026-05-25-v1",
  data_share: "2026-05-25-v1",
  terms_of_service: "2026-05-25-v1",
  privacy_policy: "2026-05-25-v1",
};

export function isCustomerConsentVersion(
  consentType: string,
  version: string,
): consentType is CustomerConsentType {
  return (
    Object.prototype.hasOwnProperty.call(
      CUSTOMER_CONSENT_VERSIONS,
      consentType,
    ) &&
    CUSTOMER_CONSENT_VERSIONS[consentType as CustomerConsentType] === version
  );
}
