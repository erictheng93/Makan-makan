import type { LeaveBalance } from '@makanmakan/shared-types';
interface Props {
    balance: LeaveBalance;
    canRequestLeave?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "request-leave": (leaveType: import("@shared/leaves").LeaveType | undefined) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onRequest-leave"?: ((leaveType: import("@shared/leaves").LeaveType | undefined) => any) | undefined;
}>, {
    canRequestLeave: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
