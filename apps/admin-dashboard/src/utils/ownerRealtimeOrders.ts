type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export interface OwnerActiveOrder {
  id: number | string;
  orderNumber: string;
  status: string;
  tableId?: number | null;
  tableNumber?: string | null;
  table?: {
    id?: number | null;
    number?: string | null;
  } | null;
  createdAt: Date | string | number;
  items?: Array<unknown>;
}

export interface OwnerRealtimeOrder {
  id: number | string;
  tableNumber: string;
  items: number;
  status: string;
  time: string;
}

export function getOwnerOrderTableLabel(order: {
  orderNumber: string;
  tableId?: number | null;
  tableNumber?: string | null;
  table?: { number?: string | null } | null;
}): string {
  return (
    order.table?.number?.trim() ||
    order.tableNumber?.trim() ||
    order.orderNumber
  );
}

export function formatOwnerOrderTime(
  createdAt: Date | string | number,
  t: Translate,
  now = new Date(),
): string {
  const date =
    createdAt instanceof Date
      ? createdAt
      : typeof createdAt === "number"
        ? new Date(createdAt)
        : new Date(createdAt);

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return t("datetime.justNow");
  }
  if (diffMins < 60) {
    return t(diffMins === 1 ? "datetime.minuteAgo" : "datetime.minutesAgo", {
      count: diffMins,
    });
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return t(diffHours === 1 ? "datetime.hourAgo" : "datetime.hoursAgo", {
      count: diffHours,
    });
  }

  const diffDays = Math.floor(diffHours / 24);
  return t(diffDays === 1 ? "datetime.dayAgo" : "datetime.daysAgo", {
    count: diffDays,
  });
}

export function toOwnerRealtimeOrder(
  order: OwnerActiveOrder,
  t: Translate,
  now = new Date(),
): OwnerRealtimeOrder {
  return {
    id: order.id,
    tableNumber: getOwnerOrderTableLabel(order),
    items: order.items?.length ?? 0,
    status: order.status,
    time: formatOwnerOrderTime(order.createdAt, t, now),
  };
}
