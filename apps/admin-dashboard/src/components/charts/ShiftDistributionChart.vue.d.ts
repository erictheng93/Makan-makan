interface ShiftData {
    id: string;
    name: string;
    count: number;
    color?: string;
}
interface Props {
    data?: ShiftData[];
    autoFetch?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    data: ShiftData[];
    autoFetch: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
