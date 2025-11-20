import type { SwapRequest } from '@/types/scheduling';
interface Props {
    requests: SwapRequest[];
    loading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    approve: (request: SwapRequest) => any;
    reject: (request: SwapRequest) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onApprove?: ((request: SwapRequest) => any) | undefined;
    onReject?: ((request: SwapRequest) => any) | undefined;
}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
