interface Props {
    title: string;
    value: string | number;
    icon: string;
    color: 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray';
    subtitle?: string;
    trend?: 'up' | 'down' | 'stable';
    progress?: number;
}
declare var __VLS_21: {};
type __VLS_Slots = {} & {
    extra?: (props: typeof __VLS_21) => any;
};
declare const __VLS_component: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    color: "green" | "blue" | "yellow" | "red" | "purple" | "gray";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
