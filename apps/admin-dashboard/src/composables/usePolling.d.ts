import { type Ref } from 'vue';
interface UsePollingReturn<T> {
    data: Ref<T | null>;
    isLoading: Ref<boolean>;
    error: Ref<string | null>;
    isActive: Ref<boolean>;
    start: () => void;
    stop: () => void;
    refresh: () => void;
}
export declare function usePolling<T>(fetchFunction: () => Promise<T>, interval?: number, immediate?: boolean): UsePollingReturn<T>;
export declare function useOrderPolling(interval?: number): UsePollingReturn<unknown>;
export declare function useDashboardPolling(interval?: number): UsePollingReturn<unknown>;
export {};
