import type { SchedulingConflict } from '@/types/scheduling';
interface Props {
    conflicts: SchedulingConflict[];
    loading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    resolve: (conflict: SchedulingConflict) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onResolve?: ((conflict: SchedulingConflict) => any) | undefined;
}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
