const QR_PLACEHOLDER_PREFIX = "pending:";

export const isQrPlaceholder = (qrCode?: string | null): boolean =>
  typeof qrCode === "string" && qrCode.trim().startsWith(QR_PLACEHOLDER_PREFIX);

export const isQrReady = (qrCode?: string | null): qrCode is string => {
  if (typeof qrCode !== "string") return false;

  const normalized = qrCode.trim();
  return normalized.length > 0 && !isQrPlaceholder(normalized);
};

export const getPrintableQrCode = (
  ...qrCodes: Array<string | null | undefined>
): string => qrCodes.find(isQrReady)?.trim() ?? "";
