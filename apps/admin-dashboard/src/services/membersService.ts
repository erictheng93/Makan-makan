import { api, unwrapApiPayload } from "./api";

export interface MemberListItem {
  memberId: string;
  displayName: string;
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
  status: "active" | "deleted";
}

export interface MemberStats {
  totalMembers: number;
  newThisMonth: number;
  repeatRate: number;
  avgOrderValueCents: number;
}

export interface MemberListResponse {
  data: MemberListItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export const membersService = {
  async list(restaurantId: string, params: Record<string, unknown>) {
    const response = await api.get<MemberListItem[]>(
      `/restaurants/${restaurantId}/members`,
      params,
    );
    return {
      data: unwrapApiPayload<MemberListItem[]>(response.data),
      pagination: (() => {
        const raw = response.data.pagination as unknown as {
          total: number;
          page: number;
          limit: number;
          pages?: number;
          totalPages?: number;
        };
        return {
          total: raw.total,
          page: raw.page,
          limit: raw.limit,
          pages: raw.pages ?? raw.totalPages ?? 1,
        };
      })(),
    };
  },
  async stats(restaurantId: string) {
    const response = await api.get<MemberStats>(
      `/restaurants/${restaurantId}/members/stats`,
    );
    return unwrapApiPayload<MemberStats>(response.data);
  },
};
