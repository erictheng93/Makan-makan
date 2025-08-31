import type { KitchenOrder } from '@/types';
interface Props {
    orders: KitchenOrder[];
    itemHeight: number;
    containerHeight?: number;
    columnsCount?: number;
    bufferSize?: number;
    loading?: boolean;
    hasMore?: boolean;
    loadMore?: () => Promise<void>;
}
declare var __VLS_1: {
    order: any;
    index: any;
};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<Props, {
    scrollToTop: (behavior?: "auto" | "smooth") => void;
    scrollToBottom: (behavior?: "auto" | "smooth") => void;
    scrollToOrder: (orderId: number, behavior?: "auto" | "smooth") => void;
    container: import("vue").Ref<HTMLElement | undefined, HTMLElement | undefined>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "load-more": () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onLoad-more"?: (() => any) | undefined;
}>, {
    loading: boolean;
    containerHeight: number;
    columnsCount: number;
    bufferSize: number;
    hasMore: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
