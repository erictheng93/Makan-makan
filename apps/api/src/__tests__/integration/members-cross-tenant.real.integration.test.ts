// Pinned before anything reads a Date. `stats()` buckets "new this month" on a
// +8 business month computed in SQL; the assertion below only proves that if
// the host clock cannot quietly agree with it. UTC is what CI runs, and a Taipei
// laptop must produce the same numbers.
process.env.TZ = "UTC";

import {
  and,
  auditLogs,
  buildRestaurantCustomerBackfillQuery,
  customerConsents,
  customerPreferences,
  customers,
  eq,
  restaurantCustomers,
  TenantMemberDirectoryService,
} from "@makanmasak/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

/** Start of the current +8 business month, as a Unix ms instant. */
function businessMonthStartMs(now = Date.now()): number {
  const shifted = new Date(now + 8 * 3_600_000);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 8 * 3_600_000
  );
}

describe("Members API — tenant isolation", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;
  let phoneCounter = 0;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  const csrf = "a".repeat(64);
  function headers(token: string, ip?: string) {
    return {
      authorization: `Bearer ${token}`,
      "x-csrf-token": csrf,
      cookie: `__Host-mm_csrf=${csrf}`,
      origin: "http://localhost:3001",
      ...(ip ? { "CF-Connecting-IP": ip } : {}),
    };
  }

  function get(path: string, token: string) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, { headers: headers(token) }),
    );
  }

  function post(
    path: string,
    token: string,
    body?: Record<string, unknown>,
    ip?: string,
  ) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, {
        method: "POST",
        headers: {
          ...headers(token, ip),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  function patch(path: string, token: string, body: Record<string, unknown>) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, {
        method: "PATCH",
        headers: {
          ...headers(token),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  async function shop(name: string) {
    const restaurant = await seed.restaurant({ name });
    const owner = await seed.user({
      username: `${name}-owner`,
      role: 1,
      restaurantId: String(restaurant.id),
    });
    return {
      restaurantId: String(restaurant.id),
      ownerId: owner.id,
      token: await testApp.authHelper.ownerToken(owner.id, restaurant.id),
    };
  }

  async function customer(
    displayName: string,
    overrides: Record<string, unknown> = {},
  ) {
    phoneCounter += 1;
    const [row] = await testApp.testDb.drizzle
      .insert(customers)
      .values({
        displayName,
        primaryPhone: `+8869${String(10_000_000 + phoneCounter)}`,
        primaryEmail: `${displayName.toLowerCase()}-${phoneCounter}@example.com`,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      } as never)
      .returning({
        id: customers.id,
        phone: customers.primaryPhone,
        email: customers.primaryEmail,
      });
    return row!;
  }

  async function member(
    restaurantId: string,
    displayName: string,
    customerOverrides: Record<string, unknown> = {},
    projectionOverrides: Record<string, unknown> = {},
  ) {
    const person = await customer(displayName, customerOverrides);
    const [row] = await testApp.testDb.drizzle
      .insert(restaurantCustomers)
      .values({
        restaurantId,
        customerId: person.id,
        orderCount: 2,
        cancelledOrderCount: 1,
        totalSpentCents: 1200,
        firstOrderAt: new Date("2026-08-01T00:00:00Z"),
        lastOrderAt: new Date("2026-08-30T00:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...projectionOverrides,
      } as never)
      .returning({ id: restaurantCustomers.id });
    return {
      memberId: row!.id,
      customerId: person.id,
      phone: person.phone!,
      email: person.email!,
    };
  }

  function auditRows() {
    return testApp.testDb.drizzle.select().from(auditLogs);
  }

  // Tenancy is not the only axis. `requireRole([0, 1])` keeps the directory away
  // from kitchen and floor staff who have a valid token for this very
  // restaurant — a guard the cross-tenant cases above cannot exercise, because
  // there the caller is an owner and the restaurant is what differs.
  it.each([
    [2, "chef"],
    [3, "service crew"],
    [4, "cashier"],
  ] as const)(
    "refuses a role-%i (%s) token for the member directory",
    async (role, label) => {
      const a = await shop(`members-role-${role}`);
      const staff = await seed.user({
        username: `members-${label.replace(/\s+/g, "-")}`,
        role,
        restaurantId: a.restaurantId,
      });
      const token = await testApp.authHelper.staffToken(
        staff.id,
        role,
        a.restaurantId,
      );
      const target = await member(a.restaurantId, `Role${role}`);

      const list = await get(`/restaurants/${a.restaurantId}/members`, token);
      expect(list.status).toBe(403);

      // The reveal endpoint is the one that discloses PII, so assert it
      // separately rather than trusting that a shared middleware chain was
      // copied onto it.
      const reveal = await post(
        `/restaurants/${a.restaurantId}/members/${target.memberId}/reveal-contact`,
        token,
      );
      expect(reveal.status).toBe(403);

      // Same for the PATCH route: it is a separate route registration with
      // its own middleware chain, so a copy-paste that dropped the role
      // guard there specifically would not be caught by the list or reveal
      // assertions above.
      const write = await patch(
        `/restaurants/${a.restaurantId}/members/${target.memberId}`,
        token,
        { note: "should never land" },
      );
      expect(write.status).toBe(403);
      await expect(auditRows()).resolves.toEqual([]);
    },
  );

  it("returns only the caller's projection and never exposes customers.id", async () => {
    const a = await shop("members-a");
    const b = await shop("members-b");
    const mine = await member(a.restaurantId, "Alice");
    await member(b.restaurantId, "Bob");

    const res = await get(`/restaurants/${a.restaurantId}/members`, a.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      memberId: mine.memberId,
      displayName: "Alice",
      // Spec §9.1: E.164 is masked in its local dial form, "+886912345678"
      // reading back as "0912***678".
      maskedPhone: expect.stringMatching(/^09\d{2}\*{3}\d{3}$/),
      maskedEmail: expect.stringMatching(/^a\*{3}@example\.com$/),
      orderCount: 2,
      totalSpentCents: 1200,
    });
    expect(Object.keys(body.data[0]!).sort()).toEqual([
      "avgOrderValueCents",
      "blockedReason",
      "cancelledOrderCount",
      "displayName",
      "firstOrderAt",
      "isBlocked",
      "lastOrderAt",
      "locale",
      "marketingReachable",
      "maskedEmail",
      "maskedPhone",
      "memberId",
      "note",
      "orderCount",
      "status",
      "tags",
      "totalSpentCents",
    ]);
    expect(JSON.stringify(body)).not.toContain(mine.customerId);
    expect(JSON.stringify(body)).not.toContain(mine.phone);
  });

  it("finds a member by the local dial form the list displays, and never by a prefix", async () => {
    const a = await shop("members-search");
    const mine = await member(a.restaurantId, "Searchable");
    await member(a.restaurantId, "Other");
    // "+886910000001" is shown as "0910***001", so that is what gets typed back
    // in. Comparing the typed form raw against the stored E.164 finds nothing.
    const localForm = `0${mine.phone.slice("+886".length)}`;

    const hit = await get(
      `/restaurants/${a.restaurantId}/members?search=${encodeURIComponent(localForm)}`,
      a.token,
    );
    expect(hit.status).toBe(200);
    const hitBody = (await hit.json()) as {
      data: Array<{ memberId: string }>;
    };
    expect(hitBody.data.map((row) => row.memberId)).toEqual([mine.memberId]);

    // A prefix must stay a miss: partial PII matching would make this endpoint
    // an enumeration tool.
    const prefix = await get(
      `/restaurants/${a.restaurantId}/members?search=${encodeURIComponent(localForm.slice(0, 6))}`,
      a.token,
    );
    const prefixBody = (await prefix.json()) as { data: unknown[] };
    expect(prefixBody.data).toHaveLength(0);
  });

  it("returns 404 for another restaurant's member and leaves the victim unchanged", async () => {
    const a = await shop("members-attacker");
    const b = await shop("members-victim");
    const victim = await member(b.restaurantId, "Victim");
    const before = await testApp.testDb.drizzle
      .select()
      .from(restaurantCustomers)
      .where(
        and(
          eq(restaurantCustomers.id, victim.memberId),
          eq(restaurantCustomers.restaurantId, b.restaurantId),
        ),
      );

    const res = await get(
      `/restaurants/${a.restaurantId}/members/${victim.memberId}`,
      a.token,
    );
    expect(res.status).toBe(404);
    await expect(
      testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers)
        .where(eq(restaurantCustomers.id, victim.memberId)),
    ).resolves.toEqual(before);
  });

  it("recomputes a tenant projection idempotently from order facts", async () => {
    const shopA = await shop("members-rollup");
    const person = await customer("Repeat");
    await seed.order(shopA.restaurantId, {
      customerId: person.id,
      status: "paid",
      totalAmountCents: 1200,
    });
    await seed.order(shopA.restaurantId, {
      customerId: person.id,
      status: "cancelled",
      totalAmountCents: 900,
    });
    const service = new TenantMemberDirectoryService(
      testApp.env.DB,
      testApp.env,
    );

    await service.recomputeForCustomer(
      { restaurantId: shopA.restaurantId },
      person.id,
    );
    await service.recomputeForCustomer(
      { restaurantId: shopA.restaurantId },
      person.id,
    );

    const [projection] = await testApp.testDb.drizzle
      .select()
      .from(restaurantCustomers)
      .where(eq(restaurantCustomers.customerId, person.id));
    expect(projection).toMatchObject({
      restaurantId: shopA.restaurantId,
      orderCount: 1,
      cancelledOrderCount: 1,
      totalSpentCents: 1200,
    });
  });

  describe("marketing reachability", () => {
    async function reachabilityOf(
      restaurantId: string,
      token: string,
      memberId: string,
    ) {
      const res = await get(
        `/restaurants/${restaurantId}/members/${memberId}`,
        token,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { marketingReachable: boolean };
      };
      return body.data.marketingReachable;
    }

    it("requires both the opt-in flag and a live marketing consent", async () => {
      const a = await shop("members-consent");
      const consented = await member(a.restaurantId, "Consented");
      const revoked = await member(a.restaurantId, "Revoked");
      const noConsent = await member(a.restaurantId, "Optin");

      await testApp.testDb.drizzle.insert(customerPreferences).values([
        { customerId: consented.customerId, marketingOptIn: 1 },
        { customerId: revoked.customerId, marketingOptIn: 1 },
        { customerId: noConsent.customerId, marketingOptIn: 1 },
      ] as never);
      await testApp.testDb.drizzle.insert(customerConsents).values([
        {
          customerId: consented.customerId,
          consentType: "marketing",
          version: "test",
          granted: 1,
        },
        {
          customerId: revoked.customerId,
          consentType: "marketing",
          version: "test",
          granted: 1,
          revokedAt: new Date("2026-08-15T00:00:00Z"),
        },
      ] as never);

      expect(
        await reachabilityOf(a.restaurantId, a.token, consented.memberId),
      ).toBe(true);
      // The stale opt-in flag must not survive the revocation.
      expect(
        await reachabilityOf(a.restaurantId, a.token, revoked.memberId),
      ).toBe(false);
      expect(
        await reachabilityOf(a.restaurantId, a.token, noConsent.memberId),
      ).toBe(false);
    });
  });

  describe("stats", () => {
    it("buckets newThisMonth on the +8 business month, not the host clock", async () => {
      const a = await shop("members-stats");
      const monthStart = businessMonthStartMs();
      await member(a.restaurantId, "Inside", {}, {
        firstOrderAt: new Date(monthStart + 3_600_000),
      } as never);
      await member(a.restaurantId, "Outside", {}, {
        firstOrderAt: new Date(monthStart - 3_600_000),
      } as never);

      const res = await get(
        `/restaurants/${a.restaurantId}/members/stats`,
        a.token,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { totalMembers: number; newThisMonth: number };
      };
      expect(body.data.totalMembers).toBe(2);
      // Deriving the boundary from the server's local midnight puts the
      // "Inside" member in the previous month for eight hours a day under UTC.
      expect(body.data.newThisMonth).toBe(1);
    });
  });

  describe("contact reveal", () => {
    it("returns the unmasked values and writes exactly one audit row", async () => {
      const a = await shop("members-reveal");
      const mine = await member(a.restaurantId, "Reveal");

      const res = await post(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}/reveal-contact`,
        a.token,
        { reason: "call back about a wrong order" },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, unknown>;
      };
      expect(body.data).toMatchObject({
        memberId: mine.memberId,
        phone: mine.phone,
        email: mine.email,
        revealedAt: expect.any(Number),
      });
      // Allow-list, matching the list endpoint's assertion above: a field added
      // later without a masking decision turns this red instead of shipping.
      expect(Object.keys(body.data).sort()).toEqual([
        "email",
        "memberId",
        "phone",
        "revealedAt",
      ]);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: a.ownerId,
        restaurantId: a.restaurantId,
        action: "customer_pii_reveal",
        resource: "restaurant_customers",
        resourceId: mine.memberId,
        success: true,
      });
      // The audit trail records that a disclosure happened, never a second copy
      // of what was disclosed, and never the platform-wide customer id.
      const serialized = JSON.stringify(rows[0]);
      expect(serialized).not.toContain(mine.customerId);
      expect(serialized).not.toContain(mine.phone);
      expect(serialized).not.toContain(mine.email);
    });

    it("accepts a request with no reason at all", async () => {
      const a = await shop("members-reveal-nobody");
      const mine = await member(a.restaurantId, "Bare");

      const res = await post(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}/reveal-contact`,
        a.token,
      );
      expect(res.status).toBe(200);
      expect(await auditRows()).toHaveLength(1);
    });

    it("rejects a reason too short to be a justification, writing no audit row", async () => {
      const a = await shop("members-reveal-short");
      const mine = await member(a.restaurantId, "Short");

      const res = await post(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}/reveal-contact`,
        a.token,
        { reason: "no" },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(await auditRows()).toHaveLength(0);
    });

    it("404s on another tenant's member, audits nothing, and leaves the victim byte-identical", async () => {
      const attacker = await shop("reveal-attacker");
      const victimShop = await shop("reveal-victim");
      const victim = await member(victimShop.restaurantId, "Victim");
      const before = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers)
        .where(eq(restaurantCustomers.id, victim.memberId));

      const res = await post(
        `/restaurants/${attacker.restaurantId}/members/${victim.memberId}/reveal-contact`,
        attacker.token,
        { reason: "cross tenant probe" },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MEMBER_NOT_FOUND");
      expect(await auditRows()).toHaveLength(0);
      await expect(
        testApp.testDb.drizzle
          .select()
          .from(restaurantCustomers)
          .where(eq(restaurantCustomers.id, victim.memberId)),
      ).resolves.toEqual(before);
    });

    it("refuses a soft-deleted customer but still audits the attempt", async () => {
      const a = await shop("members-reveal-deleted");
      const gone = await member(a.restaurantId, "Gone", {
        status: "deleted",
        deletedAt: new Date(),
      });

      const res = await post(
        `/restaurants/${a.restaurantId}/members/${gone.memberId}/reveal-contact`,
        a.token,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MEMBER_DELETED");
      expect(JSON.stringify(body)).not.toContain(gone.phone);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: "customer_pii_reveal",
        resourceId: gone.memberId,
        success: false,
      });
    });

    it("masks the member but returns nothing to reveal once the customer is deleted", async () => {
      const a = await shop("members-deleted-projection");
      const gone = await member(a.restaurantId, "Ghost", {
        status: "deleted",
        deletedAt: new Date(),
      });

      const res = await get(
        `/restaurants/${a.restaurantId}/members/${gone.memberId}`,
        a.token,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Record<string, unknown>;
      };
      // No display copy crosses the API boundary — the client renders the
      // placeholder from `status` in its own locale.
      expect(body.data).toMatchObject({
        displayName: null,
        maskedPhone: null,
        maskedEmail: null,
        status: "deleted",
        marketingReachable: false,
      });
    });

    it("caps one actor at 30 reveals an hour", async () => {
      const a = await shop("members-reveal-throttle");
      const mine = await member(a.restaurantId, "Throttled");
      const path = `/restaurants/${a.restaurantId}/members/${mine.memberId}/reveal-contact`;
      // A dedicated source address so this burst does not spend the shared
      // per-IP budget the rest of the file runs under.
      const ip = "203.0.113.77";

      for (let i = 0; i < 30; i++) {
        const ok = await post(path, a.token, undefined, ip);
        expect(ok.status).toBe(200);
      }
      const blocked = await post(path, a.token, undefined, ip);
      expect(blocked.status).toBe(429);
      const body = (await blocked.json()) as { error: { code: string } };
      expect(body.error.code).toBe("PII_REVEAL_RATE_LIMITED");
      // The refused request must not have been audited as a disclosure.
      expect(await auditRows()).toHaveLength(30);
    }, 60_000);
  });

  describe("update — tags, note, and the block marker (A3)", () => {
    it("sets tags/note/isBlocked and reads them back through the member projection", async () => {
      const a = await shop("members-update");
      const mine = await member(a.restaurantId, "Taggable");

      const res = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        {
          tags: ["vip", "regular"],
          note: "Prefers window seating",
          isBlocked: true,
          blockedReason: "Repeated chargebacks",
        },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(body.data).toMatchObject({
        memberId: mine.memberId,
        tags: ["vip", "regular"],
        note: "Prefers window seating",
        isBlocked: true,
        blockedReason: "Repeated chargebacks",
      });

      // The PATCH response is the projection already, but re-read through GET
      // to prove the write actually landed rather than merely being echoed.
      const readBack = await get(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
      );
      const readBody = (await readBack.json()) as {
        data: Record<string, unknown>;
      };
      expect(readBody.data).toMatchObject({
        tags: ["vip", "regular"],
        note: "Prefers window seating",
        isBlocked: true,
        blockedReason: "Repeated chargebacks",
      });
    });

    it("404s on another restaurant's member and leaves the victim byte-identical", async () => {
      const attacker = await shop("update-attacker");
      const victimShop = await shop("update-victim");
      const victim = await member(victimShop.restaurantId, "Victim");
      const before = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers)
        .where(eq(restaurantCustomers.id, victim.memberId));

      const res = await patch(
        `/restaurants/${attacker.restaurantId}/members/${victim.memberId}`,
        attacker.token,
        { note: "cross tenant probe" },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MEMBER_NOT_FOUND");
      await expect(
        testApp.testDb.drizzle
          .select()
          .from(restaurantCustomers)
          .where(eq(restaurantCustomers.id, victim.memberId)),
      ).resolves.toEqual(before);
      await expect(auditRows()).resolves.toEqual([]);
    });

    it("400s on an unknown body key (a customers-table field) and writes nothing", async () => {
      const a = await shop("members-update-unknown-key");
      const mine = await member(a.restaurantId, "Untouched");
      const before = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers)
        .where(eq(restaurantCustomers.id, mine.memberId));

      // primaryPhone is a `customers` column, not a restaurant_customers one.
      // Spec §7.1: any customers-table field appearing in this body must 400,
      // never be silently stripped — this is the entire point of `.strict()`.
      const res = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        { primaryPhone: "+886900000000" },
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      await expect(
        testApp.testDb.drizzle
          .select()
          .from(restaurantCustomers)
          .where(eq(restaurantCustomers.id, mine.memberId)),
      ).resolves.toEqual(before);
    });

    it("400s on an empty body instead of treating it as a no-op 200", async () => {
      const a = await shop("members-update-empty");
      const mine = await member(a.restaurantId, "Empty");

      const res = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        {},
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("writes exactly one audit row for a block and another for an unblock, clearing the reason", async () => {
      const a = await shop("members-update-audit");
      const mine = await member(a.restaurantId, "Blockable");

      const blockRes = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        { isBlocked: true, blockedReason: "Abusive to staff" },
      );
      expect(blockRes.status).toBe(200);

      let rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: a.ownerId,
        restaurantId: a.restaurantId,
        action: "member_block_status_change",
        resource: "restaurant_customers",
        resourceId: mine.memberId,
        success: true,
      });

      const unblockRes = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        { isBlocked: false },
      );
      expect(unblockRes.status).toBe(200);
      const unblockBody = (await unblockRes.json()) as {
        data: Record<string, unknown>;
      };
      // Unblocking must not leave a stale reason on an unblocked member.
      expect(unblockBody.data.blockedReason).toBeNull();
      expect(unblockBody.data.isBlocked).toBe(false);

      rows = await auditRows();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({
        action: "member_block_status_change",
        resource: "restaurant_customers",
        resourceId: mine.memberId,
        success: true,
      });
    });

    it("does not audit a tag or note edit", async () => {
      const a = await shop("members-update-no-audit");
      const mine = await member(a.restaurantId, "Housekeeping");

      const res = await patch(
        `/restaurants/${a.restaurantId}/members/${mine.memberId}`,
        a.token,
        { tags: ["vip"], note: "Called about a late delivery" },
      );
      expect(res.status).toBe(200);
      expect(await auditRows()).toEqual([]);
    });

    it("matches a tag exactly and never as a substring of a longer tag", async () => {
      const a = await shop("members-update-tag-filter");
      const vip = await member(a.restaurantId, "VipMember");
      const lapsed = await member(a.restaurantId, "LapsedVip");

      const tagVip = await patch(
        `/restaurants/${a.restaurantId}/members/${vip.memberId}`,
        a.token,
        { tags: ["vip"] },
      );
      expect(tagVip.status).toBe(200);
      const tagLapsed = await patch(
        `/restaurants/${a.restaurantId}/members/${lapsed.memberId}`,
        a.token,
        { tags: ["vip-lapsed"] },
      );
      expect(tagLapsed.status).toBe(200);

      const res = await get(
        `/restaurants/${a.restaurantId}/members?tag=vip`,
        a.token,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ memberId: string }>;
      };
      expect(body.data.map((row) => row.memberId)).toEqual([vip.memberId]);
    });
  });

  describe("historical backfill", () => {
    /**
     * Orders are inserted straight through drizzle, so
     * `OrderService.recomputeMemberProjection` never fires — which is exactly
     * the production situation the backfill exists for: a customer who ordered
     * before the projection shipped and has not come back since.
     */
    it("derives one rollup per tenant and never bleeds across restaurants", async () => {
      const a = await shop("backfill-a");
      const b = await shop("backfill-b");
      const shared = await customer("Shared");
      const onlyCancelled = await customer("OnlyCancelled");

      await seed.order(a.restaurantId, {
        customerId: shared.id,
        status: "paid",
        totalAmountCents: 1000,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      });
      await seed.order(a.restaurantId, {
        customerId: shared.id,
        status: "delivered",
        totalAmountCents: 500,
        createdAt: new Date("2026-07-05T00:00:00Z"),
      });
      await seed.order(a.restaurantId, {
        customerId: shared.id,
        status: "cancelled",
        totalAmountCents: 9999,
        createdAt: new Date("2026-07-09T00:00:00Z"),
      });
      await seed.order(b.restaurantId, {
        customerId: shared.id,
        status: "paid",
        totalAmountCents: 77,
        createdAt: new Date("2026-07-03T00:00:00Z"),
      });
      await seed.order(a.restaurantId, {
        customerId: onlyCancelled.id,
        status: "cancelled",
        totalAmountCents: 400,
      });
      // A guest order carries no customer_id and must not produce a member.
      await seed.order(a.restaurantId, { status: "paid" });

      await testApp.testDb.drizzle.run(
        buildRestaurantCustomerBackfillQuery(500),
      );

      const rows = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers);
      expect(rows).toHaveLength(2);

      const forA = rows.find((row) => row.restaurantId === a.restaurantId)!;
      expect(forA).toMatchObject({
        customerId: shared.id,
        orderCount: 2,
        cancelledOrderCount: 1,
        totalSpentCents: 1500,
      });
      expect(forA.firstOrderAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(forA.lastOrderAt?.toISOString()).toBe("2026-07-05T00:00:00.000Z");

      const forB = rows.find((row) => row.restaurantId === b.restaurantId)!;
      expect(forB).toMatchObject({
        customerId: shared.id,
        orderCount: 1,
        cancelledOrderCount: 0,
        totalSpentCents: 77,
      });

      // A customer with nothing but cancelled orders is not a member.
      expect(rows.some((row) => row.customerId === onlyCancelled.id)).toBe(
        false,
      );
    });

    it("is re-runnable and never clobbers a row the runtime already recomputed", async () => {
      const a = await shop("backfill-idempotent");
      const person = await customer("Returning");
      await seed.order(a.restaurantId, {
        customerId: person.id,
        status: "paid",
        totalAmountCents: 1000,
      });

      await testApp.testDb.drizzle.run(
        buildRestaurantCustomerBackfillQuery(500),
      );
      const [first] = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers);

      // A live order lands and the runtime recomputes; the second backfill pass
      // must leave that newer row exactly as it found it.
      await seed.order(a.restaurantId, {
        customerId: person.id,
        status: "paid",
        totalAmountCents: 250,
      });
      await new TenantMemberDirectoryService(
        testApp.env.DB,
        testApp.env,
      ).recomputeForCustomer({ restaurantId: a.restaurantId }, person.id);
      const [recomputed] = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers);
      expect(recomputed!.totalSpentCents).toBe(1250);

      await testApp.testDb.drizzle.run(
        buildRestaurantCustomerBackfillQuery(500),
      );
      const after = await testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers);
      expect(after).toHaveLength(1);
      expect(after[0]).toEqual(recomputed);
      expect(after[0]!.id).toBe(first!.id);
    });
  });
});
