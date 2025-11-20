import type { ShiftTemplate } from '@/types/scheduling';
interface Props {
    templates: ShiftTemplate[];
    loading?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (template: ShiftTemplate) => any;
    add: () => any;
    use: (template: ShiftTemplate) => any;
    edit: (template: ShiftTemplate) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onDelete?: ((template: ShiftTemplate) => any) | undefined;
    onAdd?: (() => any) | undefined;
    onUse?: ((template: ShiftTemplate) => any) | undefined;
    onEdit?: ((template: ShiftTemplate) => any) | undefined;
}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
