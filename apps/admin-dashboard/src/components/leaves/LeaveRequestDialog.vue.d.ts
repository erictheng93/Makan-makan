import type { LeaveType, LeaveBalance } from '@makanmakan/shared-types';
interface Props {
    isOpen: boolean;
    leaveTypes: LeaveType[];
    balances: LeaveBalance[];
    preselectedTypeId?: number;
}
interface LeaveRequestFormData {
    leaveTypeId: number | string;
    startDate: string;
    startPeriod: 'full' | 'am' | 'pm';
    endDate: string;
    endPeriod: 'full' | 'am' | 'pm';
    reason: string;
    attachments: File[];
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
    submit: (data: LeaveRequestFormData) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onSubmit?: ((data: LeaveRequestFormData) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
