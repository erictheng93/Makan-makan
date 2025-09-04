import type { PerformanceTrend } from '@/services/statisticsService';
interface Props {
    data: PerformanceTrend[];
    title?: string;
    width?: number;
    height?: number;
    isLoading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    isLoading: boolean;
    title: string;
    height: number;
    width: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
