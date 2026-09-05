import { api, unwrapApiPayload } from "./api";

export type MemberSort = "recent" | "spent" | "orders" | "name";

export interface MemberListItem {
  memberId: string;
  // null for a soft-deleted customer (the API stopped hardcoding a label
  // there); the view renders the localized placeholder off `status`.
  displayName: string | null;
  maskedPhone: string | null;
  maskedEmail: string | null;
  orderCount: number;
  cancelledOrderCount: number;
  totalSpentCents: number;
  avgOrderValueCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  tags: string[] | null;
  isBlocked: boolean;
  marketingReachable: boolean;
  status: "active" | "deleted";
  /** A3: tenant-local annotations. The A2 projection did not carry these. */
  note: string | null;
  blockedReason: string | null;
}

/**
 * A3 `PATCH /restaurants/:restaurantId/members/:memberId`. Every field is
 * optional but the body must change something, and an unknown key is a 400 --
 * the API rejects `customers` columns outright rather than ignoring them, so
 * only send what actually changed. `tags` replaces the whole list rather than
 * merging, which is why callers always send the full intended array.
 */
export interface MemberUpdatePayload {
  tags?: string[] | null;
  note?: string | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
}

export interface MemberStats {
  totalMembers: number;
  newThisMonth: number;
  repeatRate: number;
  avgOrderValueCents: number;
}

export interface MemberOrderItem {
  orderId: string;
  orderNumber: string;
  status: string;
  totalAmountCents: number;
  createdAt: string;
}

export interface MemberContactReveal {
  phone: string | null;
  email: string | null;
  /** Additive: the spec pins the payload to { phone, email }. */
  revealedAt?: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MemberListParams {
  page?: number;
  limit?: number;
  search?: string;
  minOrders?: number;
  /** Inclusive upper bound. The "first-time customer" pill is `maxOrders: 1`. */
  maxOrders?: number;
  minSpentCents?: number;
  /** ISO date (YYYY-MM-DD); the API coerces it to a Date. */
  lastOrderFrom?: string;
  lastOrderTo?: string;
  /** The API validates an enum of the two literal strings, not a boolean. */
  blocked?: "true" | "false";
  /** A3: exact match against one tag, never a substring of a longer one. */
  tag?: string;
  sort?: MemberSort;
}

export interface MemberListResponse {
  data: MemberListItem[];
  pagination: Pagination;
}

export interface MemberOrdersResponse {
  data: MemberOrderItem[];
  pagination: Pagination;
}

interface RawPagination {
  total: number;
  page: number;
  limit: number;
  pages?: number;
  totalPages?: number;
}

function toPagination(raw: unknown): Pagination {
  const value = (raw ?? {}) as RawPagination;
  return {
    total: value.total ?? 0,
    page: value.page ?? 1,
    limit: value.limit ?? 20,
    pages: value.pages ?? value.totalPages ?? 1,
  };
}

/**
 * The export takes the list filters minus paging -- the API rejects `page` and
 * `limit` outright, so this type is what stops a caller posting the object it
 * built for the list without trimming it first.
 */
export type MemberExportParams = Omit<MemberListParams, "page" | "limit">;

export const membersService = {
  async list(
    restaurantId: string,
    params: MemberListParams,
  ): Promise<MemberListResponse> {
    const response = await api.get<MemberListItem[]>(
      `/restaurants/${restaurantId}/members`,
      params,
    );
    return {
      data: unwrapApiPayload<MemberListItem[]>(response.data),
      pagination: toPagination(response.data.pagination),
    };
  },

  async stats(restaurantId: string): Promise<MemberStats> {
    const response = await api.get<MemberStats>(
      `/restaurants/${restaurantId}/members/stats`,
    );
    return unwrapApiPayload<MemberStats>(response.data);
  },

  async get(restaurantId: string, memberId: string): Promise<MemberListItem> {
    const response = await api.get<MemberListItem>(
      `/restaurants/${restaurantId}/members/${memberId}`,
    );
    return unwrapApiPayload<MemberListItem>(response.data);
  },

  /**
   * A3: edit this restaurant's own annotations on a member -- tags, note, and
   * the block marker. Blocking is a marker only: it does not stop the person
   * ordering (a guest order carries no customer id), so nothing here should
   * ever be presented to an operator as a barrier.
   */
  async update(
    restaurantId: string,
    memberId: string,
    payload: MemberUpdatePayload,
  ): Promise<MemberListItem> {
    const response = await api.patch<MemberListItem>(
      `/restaurants/${restaurantId}/members/${memberId}`,
      payload,
    );
    return unwrapApiPayload<MemberListItem>(response.data);
  },

  async listOrders(
    restaurantId: string,
    memberId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<MemberOrdersResponse> {
    const response = await api.get<MemberOrderItem[]>(
      `/restaurants/${restaurantId}/members/${memberId}/orders`,
      params,
    );
    return {
      data: unwrapApiPayload<MemberOrderItem[]>(response.data),
      pagination: toPagination(response.data.pagination),
    };
  },

  /**
   * A2/§7.1: masked CSV of the current filter set. POST, because the server
   * writes an audit row for the bulk read -- so this must only ever run from a
   * deliberate click, never on mount or on a filter change.
   *
   * The response is the file itself, not an envelope, and the server already
   * prefixes the UTF-8 BOM. Do not add a second one here: Excel renders a
   * double BOM as a stray character in the first header cell.
   */
  async exportCsv(
    restaurantId: string,
    params: MemberExportParams = {},
  ): Promise<Blob> {
    const response = await api.post<Blob>(
      `/restaurants/${restaurantId}/members/export`,
      params,
      { responseType: "blob" },
    );
    return response.data as unknown as Blob;
  },

  /**
   * A2: unmask one member's contact details (spec §9.2). The gate is the
   * confirm modal in the view, not a typed justification, so `reason` is
   * optional and a bodyless POST is valid. The access is written to audit_logs
   * and rate limited to 30/actor/hour, so this must only ever run from a
   * deliberate user action — never on panel open, never on hover.
   */
  async revealContact(
    restaurantId: string,
    memberId: string,
    reason?: string,
  ): Promise<MemberContactReveal> {
    const response = await api.post<MemberContactReveal>(
      `/restaurants/${restaurantId}/members/${memberId}/reveal-contact`,
      reason ? { reason } : undefined,
    );
    return unwrapApiPayload<MemberContactReveal>(response.data);
  },
};
