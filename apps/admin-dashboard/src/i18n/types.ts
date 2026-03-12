// 翻譯消息接口 — extracted to break circular dependency with locale files
export interface Messages {
  [key: string]: string | Messages;
}
