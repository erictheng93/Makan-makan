/**
 * Contact-detail masks for the tenant member directory (issue #299, spec §9.1).
 *
 * Masking happens in the service-layer projection, not the client: a value the
 * browser never receives cannot be rendered by accident, logged by a console
 * statement, or picked up by a screenshot.
 *
 * Location note: the spec sketches this file under
 * `apps/api/src/features/members/services/pii-masking.ts`, written before the
 * directory service landed in `packages/database`. Putting the helpers there
 * would force `TenantMemberDirectoryService.list()` to hand raw phone numbers
 * and e-mail addresses up to the route layer for masking, which is the exact
 * arrangement §9.1 exists to prevent. It lives beside the only projection that
 * uses it instead, and there is deliberately no second copy in the API package.
 */

/** Widest window a mask may ever open, regardless of value length. */
const PHONE_MASK_HEAD = 4;
const PHONE_MASK_TAIL = 3;

const TW_COUNTRY_CODE = "+886";

/**
 * E.164 is what we store; the local trunk form is what an operator recognises.
 * "+886912345678" is the same number a shop owner knows as "0912345678", so the
 * mask is computed on the local form and the leading 0 survives it.
 */
function toLocalDialForm(phone: string): string {
  return phone.startsWith(TW_COUNTRY_CODE)
    ? `0${phone.slice(TW_COUNTRY_CODE.length)}`
    : phone;
}

/**
 * "+886912345678" -> "0912***678".
 *
 * The `***` marker is fixed-width so the mask does not leak the value's length,
 * and the head and tail windows must not meet: taking `slice(0, 4)` and
 * `slice(-3)` independently echoed the *whole* value back for any length
 * between 5 and 7 ("12345" -> "12***345"). Budget the tail first (the last
 * digits are what an operator matches against), spend what is left on the head,
 * and always keep at least one character hidden.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const local = toLocalDialForm(phone);
  const length = local.length;
  if (length <= PHONE_MASK_HEAD) return "*".repeat(length);
  const tail = Math.min(PHONE_MASK_TAIL, length - 1);
  const head = Math.min(PHONE_MASK_HEAD, length - 1 - tail);
  return `${local.slice(0, head)}***${local.slice(length - tail)}`;
}

/** "eric@example.com" -> "e***@example.com". */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "*";
  return `${email[0]}***${email.slice(at)}`;
}
