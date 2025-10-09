import type { CountryCode } from "@makanmakan/shared-types";
interface Props {
    country: CountryCode;
    orderReference?: string;
    showQRCode?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    orderReference: string;
    showQRCode: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
