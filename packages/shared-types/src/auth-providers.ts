/**
 * Customer authentication providers.
 *
 * `customer_auth_identities.provider` is free text with no CHECK constraint, and
 * the literal `"password"` was previously hard-coded at every call site. These
 * constants are the single source of truth; follow the `CUSTOMER_CONSENT_TYPES`
 * convention in `./consents.ts` and consume them with `z.enum(...)` at the edge.
 */

/** Every provider that may appear in `customer_auth_identities.provider`. */
export const CUSTOMER_AUTH_PROVIDERS = [
  "password",
  "line",
  "google",
  "apple",
] as const;

export type CustomerAuthProvider = (typeof CUSTOMER_AUTH_PROVIDERS)[number];

/** The password provider, which is local rather than federated. */
export const CUSTOMER_PASSWORD_PROVIDER = "password" as const;

/**
 * The federated subset. These are the only values the OAuth routes accept in
 * their `:provider` path parameter — `password` has no authorization flow.
 */
export const CUSTOMER_OAUTH_PROVIDERS = ["line", "google", "apple"] as const;

export type CustomerOAuthProvider = (typeof CUSTOMER_OAUTH_PROVIDERS)[number];

export function isCustomerAuthProvider(
  value: string,
): value is CustomerAuthProvider {
  return (CUSTOMER_AUTH_PROVIDERS as readonly string[]).includes(value);
}

export function isCustomerOAuthProvider(
  value: string,
): value is CustomerOAuthProvider {
  return (CUSTOMER_OAUTH_PROVIDERS as readonly string[]).includes(value);
}
