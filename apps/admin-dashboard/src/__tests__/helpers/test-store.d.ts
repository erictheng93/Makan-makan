interface QueueItem {
    id: string;
    queueNumber: number;
    customerName: string;
    partySize: number;
    status: string;
    joinedAt?: Date;
}
export declare const useTestQueueStore: import("pinia").StoreDefinition<"queue", {
    currentQueue: QueueItem[];
    called: QueueItem[];
    seated: QueueItem[];
}, {}, {
    addCustomer(customer: QueueItem): void;
    setCurrentQueue(queue: QueueItem[]): void;
    reset(): void;
}>;
export declare const useTestApiStore: import("pinia").StoreDefinition<"api", {
    error: any;
    isLoading: boolean;
}, {
    getIsLoading: (state: {
        error: any;
        isLoading: boolean;
    } & import("pinia").PiniaCustomStateProperties<{
        error: any;
        isLoading: boolean;
    }>) => boolean;
}, {
    setError(error: any): void;
    setLoading(loading: boolean): void;
}>;
export declare const useTestRealtimeStore: import("pinia").StoreDefinition<"realtime", {
    connectionStatus: string;
}, {}, {
    setConnectionStatus(status: string): void;
}>;
export declare const useTestSettingsStore: import("pinia").StoreDefinition<"settings", {
    language: string;
    theme: string;
}, {
    getLanguage: (state: {
        language: string;
        theme: string;
    } & import("pinia").PiniaCustomStateProperties<{
        language: string;
        theme: string;
    }>) => string;
    getTheme: (state: {
        language: string;
        theme: string;
    } & import("pinia").PiniaCustomStateProperties<{
        language: string;
        theme: string;
    }>) => string;
}, {
    setLanguage(language: string): void;
    setTheme(theme: string): void;
}>;
export declare function createTestStore(): {
    reset(): void;
    getters: {
        'api/isLoading': () => boolean;
        'settings/language': () => string;
        'settings/theme': () => string;
    };
    commit(mutation: string, payload?: any): void;
    dispatch(action: string, payload?: any): void;
    install: (app: import("vue").App) => void;
    state: import("vue").Ref<Record<string, import("pinia").StateTree>>;
    use(plugin: import("pinia").PiniaPlugin): import("pinia").Pinia;
};
export {};
