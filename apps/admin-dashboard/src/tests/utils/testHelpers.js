/**
 * 測試輔助工具
 * 提供通用的測試工具函數和輔助方法
 */
// 等待條件滿足的工具函數
export async function waitFor(condition, timeout = 3000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const result = await condition();
        if (result) {
            return;
        }
        await sleep(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
}
// 睡眠工具函數
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// 創建測試用戶
export function createTestUsers(count) {
    const roles = ["creator", "admin", "member"];
    const users = [];
    for (let i = 0; i < count; i++) {
        users.push({
            id: `user-${i + 1}`,
            name: `測試用戶${i + 1}`,
            email: `user${i + 1}@test.com`,
            role: roles[i % roles.length],
            restaurantId: 1,
            isOnline: true,
            joinedAt: Date.now() - i * 60000, // 每個用戶相差1分鐘加入
        });
    }
    return users;
}
// 生成隨機字符串
export function randomString(length = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// 生成隨機數字
export function randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// 生成測試ID
export function generateTestId(prefix = "test") {
    return `${prefix}-${Date.now()}-${randomString(4)}`;
}
// 深度比較對象
export function deepEqual(obj1, obj2) {
    if (obj1 === obj2)
        return true;
    if (obj1 == null || obj2 == null)
        return false;
    if (typeof obj1 !== typeof obj2)
        return false;
    if (typeof obj1 !== "object")
        return obj1 === obj2;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (!keys2.includes(key))
            return false;
        if (!deepEqual(obj1[key], obj2[key]))
            return false;
    }
    return true;
}
// 創建測試環境配置
export function createTestConfig(overrides = {}) {
    return {
        apiUrl: "http://localhost:3000/api",
        wsUrl: "ws://localhost:8787",
        maxRetries: 3,
        timeout: 5000,
        batchDelay: 100,
        ...overrides,
    };
}
// 模擬網絡延遲
export function simulateNetworkDelay(min = 10, max = 100) {
    const delay = randomNumber(min, max);
    return sleep(delay);
}
// 創建測試定時器
export class TestTimer {
    constructor() {
        Object.defineProperty(this, "startTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "endTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    start() {
        this.startTime = Date.now();
    }
    stop() {
        this.endTime = Date.now();
        return this.getElapsed();
    }
    getElapsed() {
        const end = this.endTime || Date.now();
        return end - this.startTime;
    }
    reset() {
        this.startTime = 0;
        this.endTime = 0;
    }
}
// 批量執行異步操作
export async function batchExecute(items, executor, concurrency = 5) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map((item, index) => executor(item, i + index));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    return results;
}
// 創建測試事件監聽器
export class TestEventListener {
    constructor() {
        Object.defineProperty(this, "events", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    on(type, handler) {
        const listener = (event) => {
            const customEvent = event;
            if (customEvent.detail.type === type) {
                this.events.push({
                    type,
                    data: customEvent.detail.data,
                    timestamp: Date.now(),
                });
                handler(customEvent.detail.data);
            }
        };
        window.addEventListener("test-event", listener);
        return () => window.removeEventListener("test-event", listener);
    }
    emit(type, data) {
        window.dispatchEvent(new CustomEvent("test-event", {
            detail: { type, data },
        }));
    }
    getEvents(type) {
        return type ? this.events.filter((e) => e.type === type) : [...this.events];
    }
    clear() {
        this.events = [];
    }
    count(type) {
        return this.getEvents(type).length;
    }
}
// 性能測量工具
export class PerformanceMonitor {
    constructor() {
        Object.defineProperty(this, "measurements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    start(name) {
        const startTime = performance.now();
        return () => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            if (!this.measurements.has(name)) {
                this.measurements.set(name, []);
            }
            this.measurements.get(name).push(duration);
        };
    }
    getStats(name) {
        const durations = this.measurements.get(name) || [];
        if (durations.length === 0) {
            return null;
        }
        const sorted = durations.sort((a, b) => a - b);
        const sum = durations.reduce((a, b) => a + b, 0);
        return {
            count: durations.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / durations.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
        };
    }
    clear(name) {
        if (name) {
            this.measurements.delete(name);
        }
        else {
            this.measurements.clear();
        }
    }
    getAllStats() {
        const stats = {};
        for (const [name] of this.measurements) {
            stats[name] = this.getStats(name);
        }
        return stats;
    }
}
// 內存使用監控
export class MemoryMonitor {
    constructor() {
        Object.defineProperty(this, "baseline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    setBaseline() {
        if (typeof process !== "undefined" && process.memoryUsage) {
            this.baseline = process.memoryUsage().heapUsed;
        }
    }
    getCurrentUsage() {
        if (typeof process !== "undefined" && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }
    getIncrease() {
        return this.getCurrentUsage() - this.baseline;
    }
    getIncreaseInMB() {
        return Math.round((this.getIncrease() / (1024 * 1024)) * 100) / 100;
    }
}
// 測試數據快照工具
export class TestSnapshot {
    constructor() {
        Object.defineProperty(this, "snapshots", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    take(name, data) {
        this.snapshots.set(name, JSON.parse(JSON.stringify(data)));
    }
    get(name) {
        return this.snapshots.get(name);
    }
    compare(name1, name2) {
        const snap1 = this.get(name1);
        const snap2 = this.get(name2);
        return deepEqual(snap1, snap2);
    }
    clear(name) {
        if (name) {
            this.snapshots.delete(name);
        }
        else {
            this.snapshots.clear();
        }
    }
}
// 連接狀態模擬器
export class ConnectionSimulator {
    constructor() {
        Object.defineProperty(this, "isOnline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "quality", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "excellent"
        });
        Object.defineProperty(this, "latency", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 50
        });
    }
    setOnline(online) {
        this.isOnline = online;
        if (typeof navigator !== "undefined") {
            Object.defineProperty(navigator, "onLine", {
                value: online,
                writable: true,
            });
        }
        // 觸發相應事件
        if (online) {
            window.dispatchEvent(new Event("online"));
        }
        else {
            window.dispatchEvent(new Event("offline"));
        }
    }
    setQuality(quality) {
        this.quality = quality;
        // 根據質量設置延遲
        const latencies = {
            excellent: 50,
            good: 150,
            fair: 500,
            poor: 2000,
        };
        this.latency = latencies[quality];
        // 模擬網絡信息更新
        if (typeof navigator !== "undefined" && navigator.connection) {
            const connection = navigator.connection;
            Object.defineProperty(connection, "effectiveType", {
                value: quality === "poor" ? "2g" : quality === "fair" ? "3g" : "4g",
                writable: true,
            });
            Object.defineProperty(connection, "rtt", {
                value: this.latency,
                writable: true,
            });
            // 觸發變化事件
            connection.dispatchEvent(new Event("change"));
        }
    }
    simulateDisconnection(duration = 1000) {
        return new Promise((resolve) => {
            this.setOnline(false);
            setTimeout(() => {
                this.setOnline(true);
                resolve();
            }, duration);
        });
    }
    getStatus() {
        return {
            online: this.isOnline,
            quality: this.quality,
            latency: this.latency,
        };
    }
}
// 導出所有工具
export default {
    waitFor,
    sleep,
    createTestUsers,
    randomString,
    randomNumber,
    generateTestId,
    deepEqual,
    createTestConfig,
    simulateNetworkDelay,
    TestTimer,
    batchExecute,
    TestEventListener,
    PerformanceMonitor,
    MemoryMonitor,
    TestSnapshot,
    ConnectionSimulator,
};
