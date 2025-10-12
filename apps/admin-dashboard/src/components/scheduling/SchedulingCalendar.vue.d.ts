import type { EmployeeSchedule } from '@/types/scheduling';
interface Props {
    schedules: EmployeeSchedule[];
    loading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    dateSelect: (date: string) => any;
    scheduleClick: (schedule: EmployeeSchedule) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onDateSelect?: ((date: string) => any) | undefined;
    onScheduleClick?: ((schedule: EmployeeSchedule) => any) | undefined;
}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
