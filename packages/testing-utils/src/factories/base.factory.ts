/**
 * Base Factory for Test Data Generation
 *
 * 提供通用的工廠基礎類別和輔助函數
 */

/**
 * Factory 配置選項
 */
export interface FactoryOptions<T> {
  /** 覆寫預設值 */
  overrides?: Partial<T>;
  /** 關聯其他工廠生成的數據 */
  relations?: Record<string, any>;
  /** 自定義序列號 */
  sequence?: number;
}

/**
 * 基礎 Factory 類別
 */
export abstract class BaseFactory<T> {
  protected sequenceCounter = 0;

  /**
   * 生成單筆測試數據
   */
  abstract build(options?: FactoryOptions<T>): T;

  /**
   * 生成多筆測試數據
   */
  buildList(count: number, options?: FactoryOptions<T>): T[] {
    return Array.from({ length: count }, () =>
      this.build({
        ...options,
        sequence: options?.sequence ?? this.sequenceCounter++,
      }),
    );
  }

  /**
   * 重置序列計數器
   */
  resetSequence(): void {
    this.sequenceCounter = 0;
  }

  /**
   * 取得下一個序列號
   */
  protected getNextSequence(): number {
    return this.sequenceCounter++;
  }
}

/**
 * 輔助函數：生成隨機字串
 */
export function randomString(length: number = 8, prefix: string = ""): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 輔助函數：生成隨機數字
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 輔助函數：從陣列中隨機選擇
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 輔助函數：生成隨機布林值
 */
export function randomBoolean(trueProbability: number = 0.5): boolean {
  return Math.random() < trueProbability;
}

/**
 * 輔助函數：生成隨機日期
 */
export function randomDate(start?: Date, end?: Date): Date {
  const startDate = start || new Date(2024, 0, 1);
  const endDate = end || new Date();
  return new Date(
    startDate.getTime() +
      Math.random() * (endDate.getTime() - startDate.getTime()),
  );
}

/**
 * 輔助函數：生成隨機電話號碼 (台灣格式)
 */
export function randomPhone(): string {
  const prefix = randomChoice(["09", "02", "04", "06", "07"]);
  const number = Array.from({ length: prefix === "09" ? 8 : 7 }, () =>
    randomNumber(0, 9),
  ).join("");
  return `${prefix}${number}`;
}

/**
 * 輔助函數：生成隨機 Email
 */
export function randomEmail(domain: string = "test.com"): string {
  return `${randomString(8, "user_")}@${domain}`;
}

/**
 * 輔助函數：生成隨機 UUID v4
 *
 * 使用 Web Crypto API（Node 19+ / 瀏覽器 / Workers 皆支援）以符合
 * CodeQL `js/insecure-randomness` 規範；避免將 Math.random() 輸出
 * 用於可能被視為 security context 的欄位（例如 userId）。
 */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * 輔助函數：生成 ISO 日期字串
 */
export function randomISODate(start?: Date, end?: Date): string {
  return randomDate(start, end).toISOString();
}

/**
 * 輔助函數：生成當前時間戳 (毫秒)
 */
export function currentTimestamp(): number {
  return Date.now();
}

/**
 * 輔助函數：生成過去的時間戳
 */
export function pastTimestamp(daysAgo: number = 7): number {
  return Date.now() - daysAgo * 24 * 60 * 60 * 1000;
}

/**
 * 輔助函數：生成未來的時間戳
 */
export function futureTimestamp(daysFromNow: number = 7): number {
  return Date.now() + daysFromNow * 24 * 60 * 60 * 1000;
}
