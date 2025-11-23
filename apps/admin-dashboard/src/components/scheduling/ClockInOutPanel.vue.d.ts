import type { EmployeeSchedule } from '@/types/scheduling';
interface Props {
    employeeId?: number;
    restaurantId: number;
}
declare const _default: import("vue").DefineComponent<Props, {
    refresh: () => Promise<void>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    clockIn: (schedule: EmployeeSchedule) => any;
    clockOut: (schedule: EmployeeSchedule) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClockIn?: ((schedule: EmployeeSchedule) => any) | undefined;
    onClockOut?: ((schedule: EmployeeSchedule) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
