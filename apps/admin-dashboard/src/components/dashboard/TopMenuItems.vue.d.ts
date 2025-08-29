interface TopMenuItem {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    category?: string;
    percentage?: number;
}
interface TopMenuItemsProps {
    items: TopMenuItem[];
    loading?: boolean;
    maxItems?: number;
}
declare const _default: import("vue").DefineComponent<TopMenuItemsProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<TopMenuItemsProps> & Readonly<{}>, {
    loading: boolean;
    maxItems: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
