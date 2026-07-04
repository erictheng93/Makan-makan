const DEFAULT_PAYMENT_REDIRECT_HOSTS = [
  "checkout.stripe.com",
  "billing.stripe.com",
  "payment.ecpay.com.tw",
  "payment-stage.ecpay.com.tw",
  "pay.line.me",
  "sandbox-pay.line.me",
  "newebpay.com",
  "core.newebpay.com",
  "ccore.newebpay.com",
] as const;

interface SafeExternalHrefOptions {
  allowedHosts?: readonly string[];
  allowAnyHttpHost?: boolean;
}

function isAllowedHost(hostname: string, allowedHosts: readonly string[]) {
  const normalizedHostname = hostname.toLowerCase();

  return allowedHosts.some((host) => {
    const normalizedHost = host.toLowerCase();
    return (
      normalizedHostname === normalizedHost ||
      normalizedHostname.endsWith(`.${normalizedHost}`)
    );
  });
}

export function safeExternalHref(
  value: string | null | undefined,
  options: SafeExternalHrefOptions = {},
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const allowedHosts = options.allowedHosts ?? DEFAULT_PAYMENT_REDIRECT_HOSTS;

    if (options.allowAnyHttpHost) {
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : null;
    }

    if (url.protocol !== "https:") return null;
    if (!isAllowedHost(url.hostname, allowedHosts)) return null;

    return url.toString();
  } catch {
    return null;
  }
}
