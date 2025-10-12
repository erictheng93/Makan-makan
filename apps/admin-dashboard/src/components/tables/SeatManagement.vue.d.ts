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
    tableId: number;
    tableNumber: string;
    seats: Seat[];
    gridColumns?: number;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    update: () => any;
    seatUpdated: (seat: Seat) => any;
    seatDeleted: (seatId: number) => any;
    seatsCreated: (seats: Seat[]) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onUpdate?: (() => any) | undefined;
    onSeatUpdated?: ((seat: Seat) => any) | undefined;
    onSeatDeleted?: ((seatId: number) => any) | undefined;
    onSeatsCreated?: ((seats: Seat[]) => any) | undefined;
}>, {
    gridColumns: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
