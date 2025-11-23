interface Props {
    type?: 'text' | 'circle' | 'rect' | 'avatar' | 'card' | 'table-row' | 'list-item' | 'custom';
    width?: string | number;
    height?: string | number;
    size?: number;
    animated?: boolean;
    columns?: Array<{
        width?: string;
    }>;
}
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_component: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    size: number;
    type: "text" | "circle" | "rect" | "avatar" | "card" | "table-row" | "list-item" | "custom";
    height: string | number;
    width: string | number;
    columns: Array<{
        width?: string;
    }>;
    animated: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
