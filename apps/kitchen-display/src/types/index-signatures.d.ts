// Type definitions with index signatures for dynamic property access

export interface StringIndexable {
  [key: string]: any
}

export interface NumberIndexable {
  [key: number]: any
}

export interface StatusColors extends StringIndexable {
  pending: string
  preparing: string
  ready: string
  completed: string
  cancelled?: string
}

export interface PriorityColors extends StringIndexable {
  normal: string
  high: string
  urgent: string
}

export interface SeverityColors extends StringIndexable {
  low: string
  medium: string
  high: string
  critical: string
}

export interface HealthColors extends StringIndexable {
  healthy: string
  warning: string
  critical: string
  info?: string
}

export interface ConnectionColors extends StringIndexable {
  online: string
  degraded: string
  offline: string
}

export interface RoleColors extends NumberIndexable {
  1: string
  2: string
  3: string
  4: string
  5?: string
  6?: string
}

export interface KeyDisplayNames extends StringIndexable {
  Space: string
  Enter: string
  Tab: string
  Escape: string
  Backspace: string
  Delete: string
  ArrowUp: string
  ArrowDown: string
  ArrowLeft: string
  ArrowRight: string
  Ctrl: string
  Cmd: string
  Alt: string
  Shift: string
}

export interface ActionNames extends StringIndexable {
  quick_complete: string
  toggle_order_status: string
  toggle_fullscreen: string
  toggle_audio: string
  refresh_orders: string
  show_shortcuts: string
  start_cooking: string
  mark_ready: string
  update_status: string
  priority_change: string
  batch_operation: string
}

export interface SystemCapabilities extends StringIndexable {
  networkConnectivity: string
  localStorage: string
  webWorkers: string
  audioContext: string
  performance: string
  permissions: string
  browserCompatibility: string
}