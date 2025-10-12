import type { EmployeeSchedule, ShiftTemplate, CreateScheduleData, UpdateScheduleData } from '@/types/scheduling';
type __VLS_Props = {
    schedule?: EmployeeSchedule | null;
    shiftTemplates: ShiftTemplate[];
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
    save: (data: CreateScheduleData | UpdateScheduleData) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onSave?: ((data: CreateScheduleData | UpdateScheduleData) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
