import type { LeaveRequest, LeaveType } from '@makanmakan/shared-types';
interface Props {
    requests: LeaveRequest[];
    leaveTypes: LeaveType[];
    canCancel?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    cancel: (requestId: number) => any;
    "view-details": (requestId: number) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onCancel?: ((requestId: number) => any) | undefined;
    "onView-details"?: ((requestId: number) => any) | undefined;
}>, {
    canCancel: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
