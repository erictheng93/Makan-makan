// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Component } from "vue";
import type { MemberListItem } from "@/services/membersService";

const list = vi.hoisted(() => vi.fn());
const stats = vi.hoisted(() => vi.fn());
const getMember = vi.hoisted(() => vi.fn());
const listOrders = vi.hoisted(() => vi.fn());
const revealContact = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const exportCsv = vi.hoisted(() => vi.fn());
const confirmModal = vi.hoisted(() => vi.fn());

// `@/i18n` is deliberately NOT mocked. A `t: (key) => key` stub makes a missing
// translation key indistinguishable from a present one (#113), so every string
// assertion below is against the real zh-TW catalog.
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "shop-a" }),
}));
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}));
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({ confirm: confirmModal }),
}));
vi.mock("@/services/membersService", () => ({
  membersService: {
    list,
    stats,
    get: getMember,
    listOrders,
    revealContact,
    update,
    exportCsv,
  },
}));

// zh-TW literals, spelled out rather than read back from the catalog: an
// assertion that reads the key's own value would still pass if the key
// vanished from every other locale.
const TEXT = {
  deletedCustomer: "已刪除的顧客",
  unnamedCustomer: "未留姓名",
  marketingUnreachable: "不可行銷發送",
  emptyTitle: "尚無會員資料",
  revealAction: "顯示完整聯絡方式",
  revealNotFound: "找不到這位會員，資料可能已被移除。",
  revealRateLimited: "本小時的查看次數已達上限（每小時 30 次），請稍後再試。",
  revealForbidden: "此會員已刪除，無法查看完整聯絡方式。",
  ordersEmpty: "此會員在本店尚無訂單",
  annotationsSave: "儲存註記",
  annotationsSaved: "已儲存",
  blockAction: "封鎖此會員",
  unblockAction: "解除封鎖",
  blockExplain:
    "封鎖只是本店自己的標記，不會阻止對方下單 —— 訪客點餐沒有會員身分，擋不到。",
  blockNotFound: "找不到這位會員，可能已被移除。",
  quickFilterNew: "新客（1 單）",
  exportAction: "匯出 CSV",
  exportFailed: "匯出失敗，請稍後再試。",
} as const;

let MembersView: Component;

function member(overrides: Partial<MemberListItem> = {}): MemberListItem {
  return {
    memberId: "member-a",
    displayName: "Alice",
    maskedPhone: "0912***678",
    maskedEmail: "a***@example.com",
    orderCount: 3,
    cancelledOrderCount: 1,
    totalSpentCents: 1200,
    avgOrderValueCents: 400,
    firstOrderAt: "2026-01-02T00:00:00.000Z",
    lastOrderAt: "2026-08-30T00:00:00.000Z",
    tags: null,
    note: null,
    blockedReason: null,
    isBlocked: false,
    marketingReachable: true,
    status: "active",
    ...overrides,
  };
}

function listResponse(rows: MemberListItem[]) {
  return {
    data: rows,
    pagination: { total: rows.length, page: 1, limit: 20, pages: 1 },
  };
}

function ordersResponse(
  rows: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    totalAmountCents: number;
    createdAt: string;
  }>,
  pages = 1,
) {
  return {
    data: rows,
    pagination: { total: rows.length, page: 1, limit: 20, pages },
  };
}

async function mountView() {
  const wrapper = mount(MembersView, {
    global: { stubs: { teleport: true } },
  });
  await flushPromises();
  return wrapper;
}

async function openFirstMember(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="member-detail-member-a"]').trigger("click");
  await flushPromises();
}

describe("MembersView", () => {
  // The view pulls in the real i18n runtime (a ~5k-line zh-TW catalog) plus
  // heroicons; paying that once here keeps it out of any test's 5s budget.
  beforeAll(async () => {
    MembersView = (await import("./MembersView.vue")).default;
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue(listResponse([member()]));
    stats.mockResolvedValue({
      totalMembers: 1,
      newThisMonth: 1,
      repeatRate: 1,
      avgOrderValueCents: 400,
    });
    getMember.mockImplementation(async (_restaurantId, memberId) =>
      member({ memberId }),
    );
    listOrders.mockResolvedValue(ordersResponse([]));
    revealContact.mockResolvedValue({ phone: null, email: null });
    update.mockImplementation(async (_restaurantId, memberId, patch) =>
      member({ memberId, ...patch }),
    );
    confirmModal.mockResolvedValue(true);
    exportCsv.mockResolvedValue(new Blob(["member_id"]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the tenant member row with masked contact details", async () => {
    const wrapper = await mountView();

    const row = wrapper.get('[data-testid="member-row-member-a"]');
    expect(row.text()).toContain("Alice");
    expect(row.text()).toContain("0912***678");
    expect(row.text()).toContain("a***@example.com");
    expect(row.attributes("data-status")).toBe("active");
    expect(list).toHaveBeenCalledWith(
      "shop-a",
      expect.objectContaining({ page: 1, limit: 20, sort: "recent" }),
    );
    expect(stats).toHaveBeenCalledWith("shop-a");
  });

  it("renders the localized empty state when the tenant has no members", async () => {
    list.mockResolvedValue(listResponse([]));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain(TEXT.emptyTitle);
  });

  it("sends every advanced filter and the sort order to the service", async () => {
    const wrapper = await mountView();
    list.mockClear();

    await wrapper.get("#member-sort").setValue("spent");
    await flushPromises();
    await wrapper.get("#member-blocked").setValue("true");
    await flushPromises();

    const minOrders = wrapper.get("#member-min-orders");
    await minOrders.setValue("3");
    await minOrders.trigger("change");
    await flushPromises();

    const minSpent = wrapper.get("#member-min-spent");
    await minSpent.setValue("25");
    await minSpent.trigger("change");
    await flushPromises();

    const from = wrapper.get("#member-last-from");
    await from.setValue("2026-01-01");
    await from.trigger("change");
    await flushPromises();

    const to = wrapper.get("#member-last-to");
    await to.setValue("2026-08-31");
    await to.trigger("change");
    await flushPromises();

    expect(list).toHaveBeenLastCalledWith(
      "shop-a",
      expect.objectContaining({
        page: 1,
        limit: 20,
        sort: "spent",
        blocked: "true",
        minOrders: 3,
        // The field is entered in major units; the API takes cents.
        minSpentCents: 2500,
        lastOrderFrom: "2026-01-01",
        lastOrderTo: "2026-08-31",
      }),
    );
  });

  it("turns the regulars quick filter into a minOrders query", async () => {
    const wrapper = await mountView();
    list.mockClear();

    await wrapper.get('[data-testid="quick-filter-frequent"]').trigger("click");
    await flushPromises();

    expect(list).toHaveBeenCalledWith(
      "shop-a",
      expect.objectContaining({ minOrders: 5, page: 1 }),
    );
    expect(
      wrapper
        .get('[data-testid="quick-filter-frequent"]')
        .attributes("data-active"),
    ).toBe("true");
  });

  it("clears every filter when the reset button is pressed", async () => {
    const wrapper = await mountView();
    await wrapper.get('[data-testid="quick-filter-blocked"]').trigger("click");
    await flushPromises();
    list.mockClear();

    await wrapper.get('[data-testid="reset-filters"]').trigger("click");
    await flushPromises();

    const params = list.mock.calls.at(-1)?.[1];
    expect(params).toMatchObject({ page: 1, sort: "recent" });
    expect(params?.blocked).toBeUndefined();
    expect(params?.minOrders).toBeUndefined();
  });

  it("loads that member's summary and orders when a row is opened", async () => {
    listOrders.mockResolvedValue(
      ordersResponse([
        {
          orderId: "order-1",
          orderNumber: "A-1001",
          status: "completed",
          totalAmountCents: 900,
          createdAt: "2026-08-30T10:00:00.000Z",
        },
      ]),
    );

    const wrapper = await mountView();
    await openFirstMember(wrapper);

    expect(getMember).toHaveBeenCalledWith("shop-a", "member-a");
    expect(listOrders).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({ page: 1, limit: 20 }),
    );
    const panel = wrapper.get('[data-testid="member-detail-panel"]');
    expect(panel.text()).toContain("A-1001");
    expect(panel.text()).toContain("已完成");
    expect(wrapper.find('[data-testid="member-order-order-1"]').exists()).toBe(
      true,
    );
  });

  it("paginates the member's order history", async () => {
    listOrders.mockResolvedValue(
      ordersResponse(
        [
          {
            orderId: "order-1",
            orderNumber: "A-1001",
            status: "completed",
            totalAmountCents: 900,
            createdAt: "2026-08-30T10:00:00.000Z",
          },
        ],
        3,
      ),
    );

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    listOrders.mockClear();

    await wrapper.get('[data-testid="member-orders-next"]').trigger("click");
    await flushPromises();

    expect(listOrders).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({ page: 2, limit: 20 }),
    );
  });

  it("shows the localized empty order history", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);

    expect(wrapper.get('[data-testid="member-detail-panel"]').text()).toContain(
      TEXT.ordersEmpty,
    );
  });

  it("does not reveal contact details until the audit warning is confirmed", async () => {
    confirmModal.mockResolvedValue(false);

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();

    expect(confirmModal).toHaveBeenCalledOnce();
    expect(confirmModal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        // The audit notice has to be part of the confirmation itself.
        message: expect.stringContaining("稽核日誌"),
      }),
    );
    expect(revealContact).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "0912***678",
    );
  });

  it("sends the whole tag list and the note, not a delta", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);

    const tagInput = wrapper.get('[data-testid="member-tag-input"]');
    await tagInput.setValue("vip");
    await tagInput.trigger("keydown.enter");
    await tagInput.setValue("gluten-free");
    await tagInput.trigger("keydown.enter");
    await wrapper.get('[data-testid="member-note-input"]').setValue("怕辣");
    await wrapper
      .get('[data-testid="member-annotations-save"]')
      .trigger("click");
    await flushPromises();

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({ tags: ["vip", "gluten-free"], note: "怕辣" }),
    );
    expect(wrapper.get('[data-testid="member-annotations-saved"]').text()).toBe(
      TEXT.annotationsSaved,
    );
  });

  it("drops a removed tag from the list it sends", async () => {
    list.mockResolvedValue(listResponse([member({ tags: ["vip", "lapsed"] })]));
    getMember.mockResolvedValue(member({ tags: ["vip", "lapsed"] }));

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="member-tag-remove-vip"]').trigger("click");
    await wrapper
      .get('[data-testid="member-annotations-save"]')
      .trigger("click");
    await flushPromises();

    expect(update).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({ tags: ["lapsed"] }),
    );
  });

  it("clears the note to null rather than sending an empty string", async () => {
    list.mockResolvedValue(listResponse([member({ note: "舊備註" })]));
    getMember.mockResolvedValue(member({ note: "舊備註" }));

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="member-note-input"]').setValue("   ");
    await wrapper
      .get('[data-testid="member-annotations-save"]')
      .trigger("click");
    await flushPromises();

    expect(update).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({ note: null, tags: null }),
    );
  });

  it("will not block until the audit warning is confirmed", async () => {
    confirmModal.mockResolvedValue(false);

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="member-block-toggle"]').trigger("click");
    await flushPromises();

    expect(confirmModal).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks with the typed reason once confirmed", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper
      .get('[data-testid="member-block-reason"]')
      .setValue("多次惡意取消");
    await wrapper.get('[data-testid="member-block-toggle"]').trigger("click");
    await flushPromises();

    expect(update).toHaveBeenCalledWith(
      "shop-a",
      "member-a",
      expect.objectContaining({
        isBlocked: true,
        blockedReason: "多次惡意取消",
      }),
    );
  });

  it("offers unblock for an already blocked member and sends no reason", async () => {
    list.mockResolvedValue(
      listResponse([member({ isBlocked: true, blockedReason: "先前濫用" })]),
    );
    getMember.mockResolvedValue(
      member({ isBlocked: true, blockedReason: "先前濫用" }),
    );

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    const toggle = wrapper.get('[data-testid="member-block-toggle"]');
    expect(toggle.text()).toBe(TEXT.unblockAction);

    await toggle.trigger("click");
    await flushPromises();

    expect(update).toHaveBeenCalledWith("shop-a", "member-a", {
      isBlocked: false,
    });
  });

  it("tells the operator that blocking does not stop the person ordering", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);

    expect(wrapper.get('[data-testid="member-block-explain"]').text()).toBe(
      TEXT.blockExplain,
    );
  });

  it("surfaces a 404 from the update endpoint instead of failing silently", async () => {
    update.mockRejectedValue({ response: { status: 404 } });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="member-block-toggle"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="member-block-error"]').text()).toBe(
      TEXT.blockNotFound,
    );
  });

  it("sends the tag filter as an exact value to the service", async () => {
    const wrapper = await mountView();
    await wrapper.get('[data-testid="member-filter-tag"]').setValue("vip");
    await wrapper.get('[data-testid="member-filter-tag"]').trigger("change");
    await flushPromises();

    expect(list).toHaveBeenLastCalledWith(
      "shop-a",
      expect.objectContaining({ tag: "vip" }),
    );
  });

  it("discards an unsaved annotation draft when the drawer is closed", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="member-note-input"]').setValue("暫時的");
    await wrapper.get('[data-testid="member-detail-close"]').trigger("click");
    await flushPromises();
    await openFirstMember(wrapper);

    expect(
      (
        wrapper.get('[data-testid="member-note-input"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("");
    expect(update).not.toHaveBeenCalled();
  });

  it("reveals the full values in the panel only, never in the list row", async () => {
    revealContact.mockResolvedValue({
      phone: "+886912345678",
      email: "alice@example.com",
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();

    expect(revealContact).toHaveBeenCalledOnce();
    expect(revealContact).toHaveBeenCalledWith("shop-a", "member-a");
    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "+886912345678",
    );
    expect(wrapper.get('[data-testid="member-email"]').text()).toBe(
      "alice@example.com",
    );

    // The list row keeps the masked projection: revealed PII is panel-local.
    const row = wrapper.get('[data-testid="member-row-member-a"]');
    expect(row.text()).toContain("0912***678");
    expect(row.text()).not.toContain("+886912345678");
    expect(row.text()).not.toContain("alice@example.com");
  });

  it("re-masks the revealed values after five minutes without another request", async () => {
    vi.useFakeTimers();
    revealContact.mockResolvedValue({
      phone: "+886912345678",
      email: "alice@example.com",
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "+886912345678",
    );

    vi.advanceTimersByTime(5 * 60 * 1000);
    await flushPromises();

    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "0912***678",
    );
    expect(wrapper.find('[data-testid="reveal-contact"]').exists()).toBe(true);
    expect(revealContact).toHaveBeenCalledOnce();
  });

  it("drops the revealed values when the panel is closed", async () => {
    revealContact.mockResolvedValue({
      phone: "+886912345678",
      email: "alice@example.com",
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="mask-contact"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "0912***678",
    );
    expect(wrapper.text()).not.toContain("+886912345678");
  });

  it("surfaces a 404 from the reveal endpoint instead of failing silently", async () => {
    revealContact.mockRejectedValue({
      response: {
        status: 404,
        data: { error: { code: "MEMBER_NOT_FOUND" } },
      },
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="reveal-error"]').text()).toBe(
      TEXT.revealNotFound,
    );
    expect(wrapper.get('[data-testid="member-phone"]').text()).toBe(
      "0912***678",
    );
  });

  it("gives the PII reveal rate limit its own message", async () => {
    revealContact.mockRejectedValue({
      response: {
        status: 429,
        data: { error: { code: "PII_REVEAL_RATE_LIMITED" } },
      },
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="reveal-error"]').text()).toBe(
      TEXT.revealRateLimited,
    );
  });

  it("explains a 403 for a soft-deleted customer rather than a generic failure", async () => {
    revealContact.mockRejectedValue({
      response: {
        status: 403,
        data: { error: { code: "MEMBER_DELETED" } },
      },
    });

    const wrapper = await mountView();
    await openFirstMember(wrapper);
    await wrapper.get('[data-testid="reveal-contact"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="reveal-error"]').text()).toBe(
      TEXT.revealForbidden,
    );
  });

  it("renders the localized label for a soft-deleted customer", async () => {
    const deleted = member({
      memberId: "member-deleted",
      displayName: null,
      maskedPhone: null,
      maskedEmail: null,
      status: "deleted",
    });
    list.mockResolvedValue(listResponse([deleted]));

    const wrapper = await mountView();

    const row = wrapper.get('[data-testid="member-row-member-deleted"]');
    expect(row.text()).toContain(TEXT.deletedCustomer);
    expect(row.text()).not.toContain("null");
    expect(row.attributes("data-status")).toBe("deleted");
  });

  it("blocks the reveal action for a soft-deleted customer", async () => {
    const deleted = member({
      displayName: null,
      maskedPhone: null,
      maskedEmail: null,
      status: "deleted",
    });
    list.mockResolvedValue(listResponse([deleted]));
    getMember.mockResolvedValue(deleted);

    const wrapper = await mountView();
    await openFirstMember(wrapper);

    expect(
      wrapper.get('[data-testid="reveal-contact"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("falls back to a localized placeholder for a member with no name", async () => {
    list.mockResolvedValue(
      listResponse([member({ memberId: "member-b", displayName: "  " })]),
    );

    const wrapper = await mountView();

    const row = wrapper.get('[data-testid="member-row-member-b"]');
    expect(row.text()).toContain(TEXT.unnamedCustomer);
  });

  it("pill-marks a member who must not receive marketing", async () => {
    list.mockResolvedValue(
      listResponse([member({ marketingReachable: false })]),
    );

    const wrapper = await mountView();

    expect(wrapper.get('[data-testid="marketing-unreachable"]').text()).toBe(
      TEXT.marketingUnreachable,
    );
  });

  it("keeps the reveal affordance labelled from the catalog", async () => {
    const wrapper = await mountView();
    await openFirstMember(wrapper);

    expect(wrapper.get('[data-testid="reveal-contact"]').text()).toContain(
      TEXT.revealAction,
    );
  });
  it("filters to first-time customers with an upper bound, not a lower one", async () => {
    const wrapper = await mountView();
    list.mockClear();

    const pill = wrapper.get('[data-testid="quick-filter-new"]');
    expect(pill.text()).toBe(TEXT.quickFilterNew);
    await pill.trigger("click");
    await flushPromises();

    // `minOrders` cannot express "exactly one order", which is why the API
    // gained `maxOrders`; asserting on both keeps a future refactor from
    // quietly swapping one for the other.
    expect(list).toHaveBeenCalledWith(
      "shop-a",
      expect.objectContaining({ maxOrders: 1, minOrders: undefined }),
    );
    expect(pill.attributes("data-active")).toBe("true");
  });

  describe("CSV export", () => {
    let createObjectURL: ReturnType<typeof vi.spyOn>;
    let revokeObjectURL: ReturnType<typeof vi.spyOn>;
    let clicks: number;

    beforeEach(() => {
      clicks = 0;
      // jsdom implements neither, and an <a download> click is a no-op there,
      // so both are stubbed rather than exercised.
      createObjectURL = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:members");
      revokeObjectURL = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => undefined);
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function (this: HTMLAnchorElement) {
          clicks += 1;
        },
      );
    });

    afterEach(() => {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      vi.restoreAllMocks();
    });

    it("exports the filters the operator is looking at, minus paging", async () => {
      const wrapper = await mountView();
      await wrapper.get("#member-sort").setValue("spent");
      await flushPromises();

      const button = wrapper.get('[data-testid="member-export"]');
      expect(button.text()).toBe(TEXT.exportAction);
      await button.trigger("click");
      await flushPromises();

      expect(exportCsv).toHaveBeenCalledOnce();
      const [restaurantId, params] = exportCsv.mock.calls[0]!;
      expect(restaurantId).toBe("shop-a");
      expect(params).toEqual(expect.objectContaining({ sort: "spent" }));
      // The API rejects these outright; sending them would 400 the export.
      expect(params).not.toHaveProperty("page");
      expect(params).not.toHaveProperty("limit");
      expect(clicks).toBe(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:members");
    });

    it("never exports on mount or on a filter change", async () => {
      const wrapper = await mountView();
      await wrapper.get("#member-sort").setValue("orders");
      await flushPromises();

      // The server writes an audit row for every call, so anything other than
      // a deliberate click would forge a trail of reads nobody performed.
      expect(exportCsv).not.toHaveBeenCalled();
    });

    it("surfaces a failed export instead of failing silently", async () => {
      exportCsv.mockRejectedValue(new Error("boom"));
      const wrapper = await mountView();

      await wrapper.get('[data-testid="member-export"]').trigger("click");
      await flushPromises();

      expect(wrapper.get('[data-testid="member-export-error"]').text()).toBe(
        TEXT.exportFailed,
      );
    });
  });
});
