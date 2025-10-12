import type { PerformanceTrend } from "@/services/statisticsService";
interface Props {
    data: PerformanceTrend[];
    title?: string;
    width?: number;
    height?: number;
    isLoading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    title: string;
    width: number;
    isLoading: boolean;
    height: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
