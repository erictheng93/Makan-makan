import type { DashboardLayout, WidgetType } from '@/types/monitoring-layout';
interface Props {
    modelValue: DashboardLayout;
    editMode?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    cancel: () => any;
    save: (layout: DashboardLayout) => any;
    "update:modelValue": (layout: DashboardLayout) => any;
    "add-widget": (type: WidgetType) => any;
    "remove-widget": (widgetId: string) => any;
    "configure-widget": (widgetId: string) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onCancel?: (() => any) | undefined;
    onSave?: ((layout: DashboardLayout) => any) | undefined;
    "onUpdate:modelValue"?: ((layout: DashboardLayout) => any) | undefined;
    "onAdd-widget"?: ((type: WidgetType) => any) | undefined;
    "onRemove-widget"?: ((widgetId: string) => any) | undefined;
    "onConfigure-widget"?: ((widgetId: string) => any) | undefined;
}>, {
    editMode: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
