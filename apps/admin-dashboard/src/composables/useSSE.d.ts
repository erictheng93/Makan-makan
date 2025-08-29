export declare function useSSE(): {
    isConnected: Readonly<import("vue").Ref<boolean, boolean>>;
    connect: () => void;
    disconnect: () => void;
    reconnectAttempts: Readonly<import("vue").Ref<number, number>>;
};
