/**
 * WebSocket Mock 工具
 * 用於測試實時功能
 */
export declare class MockWebSocket {
    readyState: number;
    url: string;
    protocol: string;
    private listeners;
    private sentMessages;
    connectionAttempts: number;
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    constructor(url: string, protocol?: string);
    send(data: string | ArrayBuffer): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: Function): void;
    removeEventListener(type: string, listener: Function): void;
    private dispatchEvent;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    mockReceiveMessage(data: any): void;
    mockError(error?: any): void;
    mockResponse(response: any): void;
    open(): void;
    getSentMessages(): any[];
    getLastSentMessage(): any;
    clearSentMessages(): void;
    reset(): void;
    private handleMockResponse;
}
export declare function createMockWebSocket(): MockWebSocket & {
    constructor: typeof MockWebSocket;
};
export declare class MockEventSource {
    readyState: number;
    url: string;
    private listeners;
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    constructor(url: string);
    close(): void;
    addEventListener(type: string, listener: Function): void;
    removeEventListener(type: string, listener: Function): void;
    private dispatchEvent;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    mockMessage(data: any, eventType?: string): void;
}
export declare function setupGlobalWebSocketMock(): () => void;
