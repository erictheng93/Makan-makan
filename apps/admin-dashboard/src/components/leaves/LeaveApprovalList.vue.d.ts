import type { LeaveRequest } from '@makanmakan/shared-types';
interface Props {
    requests: LeaveRequest[];
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    approve: (requestId: number) => any;
    reject: (requestId: number) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onApprove?: ((requestId: number) => any) | undefined;
    onReject?: ((requestId: number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
