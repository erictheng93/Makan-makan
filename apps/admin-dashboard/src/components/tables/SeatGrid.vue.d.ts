interface Seat {
    id: number;
    tableId: number;
    seatNumber: string;
    seatName?: string;
    position?: string;
    qrCode: string;
    isOccupied: boolean;
    isActive: boolean;
    currentOrderId?: number;
    occupiedBy?: string;
    totalUsage: number;
}
interface Props {
    seats: Seat[];
    columns?: number;
    showDetails?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    seatClick: (seat: Seat) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onSeatClick?: ((seat: Seat) => any) | undefined;
}>, {
    columns: number;
    showDetails: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
