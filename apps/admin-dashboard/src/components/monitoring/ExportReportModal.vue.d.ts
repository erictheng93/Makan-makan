import type { ExportDataType } from '@/types/monitoring-export';
interface Props {
    show: boolean;
    data: any[];
    defaultDataType?: ExportDataType;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
    exported: (filename: string) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onExported?: ((filename: string) => any) | undefined;
}>, {
    defaultDataType: ExportDataType;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
