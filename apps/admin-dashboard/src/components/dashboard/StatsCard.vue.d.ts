interface StatsCardProps {
    title: string;
    value: string | number;
    icon: string;
    color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo';
    loading?: boolean;
    trend?: {
        value: number;
        period: string;
    };
    subtitle?: string;
}
declare const _default: import("vue").DefineComponent<StatsCardProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<StatsCardProps> & Readonly<{}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
