import type { MonitoringFilter, SavedFilter } from '@/types/monitoring-filters';
interface Props {
    modelValue: MonitoringFilter;
    savedFilters?: SavedFilter[];
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (filterId: string) => any;
    load: (filterId: string) => any;
    reset: () => any;
    save: (name: string, filter: MonitoringFilter) => any;
    apply: (filter: MonitoringFilter) => any;
    "update:modelValue": (filter: MonitoringFilter) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onDelete?: ((filterId: string) => any) | undefined;
    onLoad?: ((filterId: string) => any) | undefined;
    onReset?: (() => any) | undefined;
    onSave?: ((name: string, filter: MonitoringFilter) => any) | undefined;
    onApply?: ((filter: MonitoringFilter) => any) | undefined;
    "onUpdate:modelValue"?: ((filter: MonitoringFilter) => any) | undefined;
}>, {
    savedFilters: SavedFilter[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
