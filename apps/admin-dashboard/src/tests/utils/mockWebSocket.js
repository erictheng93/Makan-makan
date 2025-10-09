/**
 * WebSocket Mock 工具
 * 用於測試實時功能
 */
import { vi } from "vitest";
export class MockWebSocket {
    constructor(url, protocol) {
        Object.defineProperty(this, "readyState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: WebSocket.CONNECTING
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "protocol", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "sentMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "connectionAttempts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // 事件處理器屬性
        Object.defineProperty(this, "onopen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onclose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onmessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onerror", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.url = url;
        this.protocol = protocol || "";
        this.connectionAttempts++;
        // 模擬異步連接
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.dispatchEvent(new Event("open"));
        }, 10);
    }
    // 發送消息
    send(data) {
        if (this.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not open");
        }
        try {
            const message = typeof data === "string" ? JSON.parse(data) : data;
            this.sentMessages.push(message);
            // 模擬服務器響應
            this.handleMockResponse(message);
        }
        catch (error) {
            console.error("Mock WebSocket send error:", error);
        }
    }
    // 關閉連接
    close(code, reason) {
        this.readyState = WebSocket.CLOSING;
        setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            this.dispatchEvent(new CloseEvent("close", { code: code || 1000, reason }));
        }, 10);
    }
    // 添加事件監聽器
    addEventListener(type, listener) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
    }
    // 移除事件監聽器
    removeEventListener(type, listener) {
        if (this.listeners[type]) {
            const index = this.listeners[type].indexOf(listener);
            if (index !== -1) {
                this.listeners[type].splice(index, 1);
            }
        }
    }
    // 分發事件
    dispatchEvent(event) {
        const type = event.type;
        if (this.listeners[type]) {
            this.listeners[type].forEach((listener) => {
                try {
                    listener(event);
                }
                catch (error) {
                    console.error("Mock WebSocket event listener error:", error);
                }
            });
        }
        // 調用 on* 處理器
        const handlerName = `on${type}`;
        if (typeof this[handlerName] === "function") {
            this[handlerName](event);
        }
    }
    // 測試工具方法
    // 模擬接收消息
    mockReceiveMessage(data) {
        if (this.readyState === WebSocket.OPEN) {
            const messageEvent = new MessageEvent("message", {
                data: typeof data === "string" ? data : JSON.stringify(data),
            });
            this.dispatchEvent(messageEvent);
        }
    }
    // 模擬連接錯誤
    mockError(error) {
        const errorEvent = new Event("error");
        if (error) {
            errorEvent.error = error;
        }
        this.dispatchEvent(errorEvent);
    }
    // 模擬服務器響應
    mockResponse(response) {
        setTimeout(() => {
            this.mockReceiveMessage(response);
        }, 5);
    }
    // 強制打開連接（測試用）
    open() {
        if (this.readyState === WebSocket.CLOSED ||
            this.readyState === WebSocket.CLOSING) {
            this.readyState = WebSocket.OPEN;
            this.dispatchEvent(new Event("open"));
        }
    }
    // 獲取發送的消息
    getSentMessages() {
        return [...this.sentMessages];
    }
    // 獲取最後發送的消息
    getLastSentMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
    }
    // 清空發送記錄
    clearSentMessages() {
        this.sentMessages = [];
    }
    // 重置mock狀態
    reset() {
        this.sentMessages = [];
        this.connectionAttempts = 0;
        this.readyState = WebSocket.CLOSED;
        this.listeners = {};
    }
    // 處理模擬響應邏輯
    handleMockResponse(message) {
        // 根據消息類型自動生成響應
        switch (message.type) {
            case "join_group_order":
                this.mockResponse({
                    type: "group_order_joined",
                    success: true,
                    groupOrder: {
                        id: message.data.shareCode,
                        shareCode: message.data.shareCode,
                        status: "active",
                        members: [
                            {
                                id: "mock-member-id",
                                name: message.data.memberName,
                                isOnline: true,
                            },
                        ],
                    },
                    memberId: "mock-member-id",
                });
                break;
            case "add_cart_item":
                this.mockResponse({
                    type: "cart_item_added",
                    success: true,
                    item: {
                        id: "mock-item-id",
                        ...message.data,
                    },
                });
                break;
            case "heartbeat":
                this.mockResponse({
                    type: "heartbeat_ack",
                    timestamp: Date.now(),
                });
                break;
        }
    }
}
// WebSocket 常量
Object.defineProperty(MockWebSocket, "CONNECTING", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(MockWebSocket, "OPEN", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1
});
Object.defineProperty(MockWebSocket, "CLOSING", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2
});
Object.defineProperty(MockWebSocket, "CLOSED", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 3
});
// 創建WebSocket mock工廠
export function createMockWebSocket() {
    const mockInstance = new MockWebSocket("ws://localhost:8787/websocket");
    // 創建構造函數mock
    const MockWebSocketConstructor = vi
        .fn()
        .mockImplementation((url, protocol) => {
        return new MockWebSocket(url, protocol);
    });
    // 添加WebSocket常量
    MockWebSocketConstructor.CONNECTING = WebSocket.CONNECTING;
    MockWebSocketConstructor.OPEN = WebSocket.OPEN;
    MockWebSocketConstructor.CLOSING = WebSocket.CLOSING;
    MockWebSocketConstructor.CLOSED = WebSocket.CLOSED;
    return Object.assign(mockInstance, { constructor: MockWebSocketConstructor });
}
// 模擬SSE EventSource
export class MockEventSource {
    constructor(url) {
        Object.defineProperty(this, "readyState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        // 事件處理器
        Object.defineProperty(this, "onopen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onmessage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onerror", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.url = url;
        // 模擬連接
        setTimeout(() => {
            this.readyState = 1;
            this.dispatchEvent(new Event("open"));
        }, 10);
    }
    close() {
        this.readyState = 2;
        this.dispatchEvent(new Event("close"));
    }
    addEventListener(type, listener) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
    }
    removeEventListener(type, listener) {
        if (this.listeners[type]) {
            const index = this.listeners[type].indexOf(listener);
            if (index !== -1) {
                this.listeners[type].splice(index, 1);
            }
        }
    }
    dispatchEvent(event) {
        const type = event.type;
        if (this.listeners[type]) {
            this.listeners[type].forEach((listener) => listener(event));
        }
        // 調用 on* 處理器
        const handlerName = `on${type}`;
        if (typeof this[handlerName] === "function") {
            this[handlerName](event);
        }
    }
    // 測試工具方法
    mockMessage(data, eventType) {
        const messageEvent = new MessageEvent(eventType || "message", {
            data: typeof data === "string" ? data : JSON.stringify(data),
        });
        this.dispatchEvent(messageEvent);
    }
}
// EventSource 常量
Object.defineProperty(MockEventSource, "CONNECTING", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(MockEventSource, "OPEN", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1
});
Object.defineProperty(MockEventSource, "CLOSED", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2
});
// 全局WebSocket mock設置
export function setupGlobalWebSocketMock() {
    const originalWebSocket = global.WebSocket;
    const originalEventSource = global.EventSource;
    const mockWS = createMockWebSocket();
    global.WebSocket = mockWS.constructor;
    global.EventSource = MockEventSource;
    // 返回清理函數
    return () => {
        global.WebSocket = originalWebSocket;
        global.EventSource = originalEventSource;
    };
}
