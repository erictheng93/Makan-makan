/**
 * 測試輔助工具
 * 提供通用的測試工具函數和輔助方法
 */
export declare function waitFor(condition: () => boolean | Promise<boolean>, timeout?: number, interval?: number): Promise<void>;
export declare function sleep(ms: number): Promise<void>;
export declare function createTestUsers(count: number): {
    id: string;
    name: string;
    email: string;
    role: string;
    restaurantId: number;
    isOnline: boolean;
    joinedAt: number;
}[];
export declare function randomString(length?: number): string;
export declare function randomNumber(min?: number, max?: number): number;
export declare function generateTestId(prefix?: string): string;
export declare function deepEqual(obj1: any, obj2: any): boolean;
export declare function createTestConfig(overrides?: any): any;
export declare function simulateNetworkDelay(min?: number, max?: number): Promise<void>;
export declare class TestTimer {
    private startTime;
    private endTime;
    start(): void;
    stop(): number;
    getElapsed(): number;
    reset(): void;
}
export declare function batchExecute<T>(items: T[], executor: (item: T, index: number) => Promise<any>, concurrency?: number): Promise<any[]>;
export declare class TestEventListener {
    private events;
    on(type: string, handler: (data: any) => void): () => void;
    emit(type: string, data: any): void;
    getEvents(type?: string): Array<{
        type: string;
        data: any;
        timestamp: number;
    }>;
    clear(): void;
    count(type?: string): number;
}
export declare class PerformanceMonitor {
    private measurements;
    start(name: string): () => void;
    getStats(name: string): {
        count: number;
        min: number;
        max: number;
        avg: number;
        median: number;
        p95: number;
        p99: number;
    } | null;
    clear(name?: string): void;
    getAllStats(): any;
}
export declare class MemoryMonitor {
    private baseline;
    setBaseline(): void;
    getCurrentUsage(): number;
    getIncrease(): number;
    getIncreaseInMB(): number;
}
export declare class TestSnapshot {
    private snapshots;
    take(name: string, data: any): void;
    get(name: string): any;
    compare(name1: string, name2: string): boolean;
    clear(name?: string): void;
}
export declare class ConnectionSimulator {
    private isOnline;
    private quality;
    private latency;
    setOnline(online: boolean): void;
    setQuality(quality: typeof this.quality): void;
    simulateDisconnection(duration?: number): Promise<void>;
    getStatus(): {
        online: boolean;
        quality: "excellent" | "good" | "fair" | "poor";
        latency: number;
    };
}
declare const _default: {
    waitFor: typeof waitFor;
    sleep: typeof sleep;
    createTestUsers: typeof createTestUsers;
    randomString: typeof randomString;
    randomNumber: typeof randomNumber;
    generateTestId: typeof generateTestId;
    deepEqual: typeof deepEqual;
    createTestConfig: typeof createTestConfig;
    simulateNetworkDelay: typeof simulateNetworkDelay;
    TestTimer: typeof TestTimer;
    batchExecute: typeof batchExecute;
    TestEventListener: typeof TestEventListener;
    PerformanceMonitor: typeof PerformanceMonitor;
    MemoryMonitor: typeof MemoryMonitor;
    TestSnapshot: typeof TestSnapshot;
    ConnectionSimulator: typeof ConnectionSimulator;
};
export default _default;
