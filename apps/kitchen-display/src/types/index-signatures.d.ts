// Type definitions with index signatures for dynamic property access

import type { Plugin } from "vue";

declare global {
  interface KitchenPerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }

  interface KitchenNetworkInformation extends EventTarget {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }

  interface KitchenSpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  interface KitchenSpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): KitchenSpeechRecognitionAlternative;
    [index: number]: KitchenSpeechRecognitionAlternative;
  }

  interface KitchenSpeechRecognitionResultList {
    readonly length: number;
    item(index: number): KitchenSpeechRecognitionResult;
    [index: number]: KitchenSpeechRecognitionResult;
  }

  interface KitchenSpeechRecognitionEvent extends Event {
    readonly results: KitchenSpeechRecognitionResultList;
  }

  interface KitchenSpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message?: string;
  }

  interface KitchenSpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult:
      | ((
          this: KitchenSpeechRecognition,
          event: KitchenSpeechRecognitionEvent,
        ) => void)
      | null;
    onerror:
      | ((
          this: KitchenSpeechRecognition,
          event: KitchenSpeechRecognitionErrorEvent,
        ) => void)
      | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  interface KitchenSpeechRecognitionConstructor {
    new (): KitchenSpeechRecognition;
  }

  interface Performance {
    memory?: KitchenPerformanceMemory;
  }

  interface Navigator {
    connection?: KitchenNetworkInformation;
    mozConnection?: KitchenNetworkInformation;
    webkitConnection?: KitchenNetworkInformation;
    memory?: KitchenPerformanceMemory;
  }

  interface Window {
    SpeechRecognition?: KitchenSpeechRecognitionConstructor;
    webkitSpeechRecognition?: KitchenSpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
    mozAudioContext?: typeof AudioContext;
    __lazyComponentPlugin?: Plugin;
  }
}

export interface StringIndexable {
  [key: string]: any;
}

export interface NumberIndexable {
  [key: number]: any;
}

export interface StatusColors extends StringIndexable {
  pending: string;
  preparing: string;
  ready: string;
  completed: string;
  cancelled?: string;
}

export interface PriorityColors extends StringIndexable {
  normal: string;
  high: string;
  urgent: string;
}

export interface SeverityColors extends StringIndexable {
  low: string;
  medium: string;
  high: string;
  critical: string;
}

export interface HealthColors extends StringIndexable {
  healthy: string;
  warning: string;
  critical: string;
  info?: string;
}

export interface ConnectionColors extends StringIndexable {
  online: string;
  degraded: string;
  offline: string;
}

export interface RoleColors extends NumberIndexable {
  1: string;
  2: string;
  3: string;
  4: string;
  5?: string;
  6?: string;
}

export interface KeyDisplayNames extends StringIndexable {
  Space: string;
  Enter: string;
  Tab: string;
  Escape: string;
  Backspace: string;
  Delete: string;
  ArrowUp: string;
  ArrowDown: string;
  ArrowLeft: string;
  ArrowRight: string;
  Ctrl: string;
  Cmd: string;
  Alt: string;
  Shift: string;
}

export interface ActionNames extends StringIndexable {
  quick_complete: string;
  toggle_order_status: string;
  toggle_fullscreen: string;
  toggle_audio: string;
  refresh_orders: string;
  show_shortcuts: string;
  start_cooking: string;
  mark_ready: string;
  update_status: string;
  priority_change: string;
  batch_operation: string;
}

export interface SystemCapabilities extends StringIndexable {
  networkConnectivity: string;
  localStorage: string;
  webWorkers: string;
  audioContext: string;
  performance: string;
  permissions: string;
  browserCompatibility: string;
}
