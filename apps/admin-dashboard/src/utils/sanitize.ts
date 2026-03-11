/** Sanitize values for safe logging (prevent log injection via newlines/control chars) */
export function sanitizeForLog(value: unknown): string {
  return String(value)
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 500);
}
