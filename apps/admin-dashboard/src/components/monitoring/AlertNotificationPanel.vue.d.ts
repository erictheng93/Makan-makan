import type { AlertNotification, ConnectionStatus } from '@/services/monitoringWebSocket';
interface Props {
    alerts: AlertNotification[];
    connectionStatus: ConnectionStatus;
    showConnectionStatus?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    clearAll: () => any;
    reconnect: () => any;
    acknowledge: (alertId: string) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClearAll?: (() => any) | undefined;
    onReconnect?: (() => any) | undefined;
    onAcknowledge?: ((alertId: string) => any) | undefined;
}>, {
    showConnectionStatus: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
