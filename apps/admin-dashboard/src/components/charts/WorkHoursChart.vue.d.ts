interface EmployeeHours {
    employeeId: string;
    employeeName: string;
    hours: number;
}
interface Props {
    data?: EmployeeHours[];
    autoFetch?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    data: EmployeeHours[];
    autoFetch: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
