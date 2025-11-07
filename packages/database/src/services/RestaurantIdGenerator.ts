/**
 * Restaurant Public ID Generator
 * 生成格式: S-20251026-001
 */

export class RestaurantIdGenerator {
  constructor(private db: D1Database) {}

  /**
   * 生成新的餐廳公開 ID
   * @returns 格式化的 ID，例如 "S-20251026-001"
   */
  async generatePublicId(): Promise<string> {
    const today = this.getFormattedDate();
    const prefix = 'S'; // S = Shop/Store

    // 獲取當天最後一個序號
    const lastSerial = await this.getLastSerialForToday(today);
    const newSerial = lastSerial + 1;

    // 格式化序號為 3 位數
    const serialStr = newSerial.toString().padStart(3, '0');

    return `${prefix}-${today}-${serialStr}`;
  }

  /**
   * 獲取當天的最後序號
   */
  private async getLastSerialForToday(date: string): Promise<number> {
    const pattern = `S-${date}-%`;

    const result = await this.db
      .prepare(`
        SELECT public_id
        FROM restaurants
        WHERE public_id LIKE ?
        ORDER BY public_id DESC
        LIMIT 1
      `)
      .bind(pattern)
      .first<{ public_id: string }>();

    if (!result || !result.public_id) {
      return 0;
    }

    // 提取序號部分: S-20251026-001 → 001
    const parts = result.public_id.split('-');
    const serialStr = parts[2];

    return parseInt(serialStr, 10);
  }

  /**
   * 獲取格式化日期 (YYYYMMDD)
   */
  private getFormattedDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  /**
   * 驗證 Public ID 格式
   */
  static validateFormat(publicId: string): boolean {
    const pattern = /^S-\d{8}-\d{3}$/;
    return pattern.test(publicId);
  }

  /**
   * 從 Public ID 提取日期
   */
  static extractDate(publicId: string): Date | null {
    if (!this.validateFormat(publicId)) {
      return null;
    }

    const parts = publicId.split('-');
    const dateStr = parts[1]; // 20251026

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));

    return new Date(year, month, day);
  }

  /**
   * 從 Public ID 提取序號
   */
  static extractSerial(publicId: string): number | null {
    if (!this.validateFormat(publicId)) {
      return null;
    }

    const parts = publicId.split('-');
    return parseInt(parts[2], 10);
  }
}

/**
 * 使用範例:
 *
 * const generator = new RestaurantIdGenerator(db);
 * const publicId = await generator.generatePublicId();
 * // 返回: "S-20251026-001"
 *
 * // 驗證格式
 * RestaurantIdGenerator.validateFormat("S-20251026-001"); // true
 * RestaurantIdGenerator.validateFormat("INVALID"); // false
 *
 * // 提取資訊
 * const date = RestaurantIdGenerator.extractDate("S-20251026-001");
 * const serial = RestaurantIdGenerator.extractSerial("S-20251026-001"); // 1
 */
