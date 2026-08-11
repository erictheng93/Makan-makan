# Group Ordering — Phase D: Split Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the one real gap in split billing — the `"proportional"` split type is accepted by validation but unimplemented in the service (silently returns `"Unsupported split type: proportional"`) — and fix a rounding-remainder gap in `"equal"` splits, so the numbers Phase C's finalize computes for each member always sum to exactly the order total.

**Architecture:** `GroupOrdersService.splitBill` (already called internally by Phase C's `finalizeGroupOrder`) already correctly implements `"equal"`, `"individual"`/`"by_item"`, and `"custom"`. `"processPayment"` (mark a member's `split_bills` row paid) already works for Plan A manual settlement exactly as-is — a host or cashier calling it with `paymentMethod: "cash"` needs no code change at all, only a test proving it. This phase adds the missing branch and a shared rounding-remainder correction, both inside `splitBill`; no new endpoints.

**Tech Stack:** Drizzle ORM, Vitest.

## Global Constraints

- Money math inside `splitBill` is done in plain (dollar) floats and only converted to cents at the DB-write boundary via `toRequiredCents` (`apps/api/src/shared/utils/money.ts`) — follow that existing convention, don't introduce a second cents-native code path alongside it.
- `"proportional"` still has no way to diverge numerically from `"individual"` — see Task 1's note on why, and implement it as what it actually is today rather than inventing a fake distinguishing calculation. **X-1 does not change this.** Tax and service charge are themselves proportional to subtotal, so distributing them by subtotal share equals applying one rate to each member's own subtotal. Anyone reading X-1 as "now proportional finally differs" and reverse-engineering a difference to prove it has broken this constraint.
- **X-1 (decided 2026-08-05):** `splitBill` gains `sharedServiceChargeCents`, `sharedTaxCents` and `orderTotalCents`. Phase C's `finalizeGroupOrder` fills these from the order `OrderService.createOrder` just created, so the split can never disagree with what the restaurant actually charged. Without this, Phase C and this phase together produce split bills summing to item subtotal while the customer is charged subtotal + tax + service charge — see Phase C Task 2, Step 3.
- Absolute shared costs **take precedence over** `serviceChargeRate`/`taxRate` when both are present. The existing `POST /orders/group/:id/split` route still supplies rates and must keep working unchanged; applying both would double-charge. One `if` at the top of `splitBill`, not a rule scattered through four branches.
- These new inputs are named in **cents** because that is what the order carries and what the DB stores. Convert them into the float-dollar domain **once**, immediately on entry, so the rest of `splitBill` keeps working in the single unit it already uses. A cents value flowing into a dollar-denominated expression is how a 100× error reaches a customer's bill.

---

## Current code this phase touches (verified 2026-08-04)

- `GroupOrdersService.splitBill` (`apps/api/src/features/group-orders/services/GroupOrdersService.ts:919-1205`) — the `if/else if` chain over `splitData.splitType` (lines 992-1083) has branches for `"by_item"/"individual"`, `"equal"`, `"custom"`; anything else (including `"proportional"`, already a valid value in `splitBillSchema`'s enum at `schemas/validation.ts:104-109`) falls to the final `else` and returns `{ success: false, error: "Unsupported split type: ..." }`.
- The `"equal"` branch (lines 1025-1045) divides `totalCartAmount` (a float dollar amount) by `memberCount` and independently rounds each member's `totalAmountCents` via `toRequiredCents` at insert time (line 1097) — with no reconciliation step, so `sum(member totals in cents)` can differ from `toRequiredCents(totalCartAmount)` by a cent or two whenever the division doesn't terminate exactly (e.g. NT$100 / 3 members).
- `processPayment` (line 1210) already accepts `paymentMethod: string` freely (not restricted to a real-gateway enum) and marks `split_bills.paymentStatus = "paid"` — using it with `paymentMethod: "cash"` for Plan A settlement requires no code change (Task 3 is test-only).

---

### Task 1: Implement the `"proportional"` split branch

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts:992-1083`
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`

**Interfaces:**
- `SplitBillRequest` (`apps/api/src/features/group-orders/types/index.ts:162`) gains `sharedServiceChargeCents?: number`, `sharedTaxCents?: number`, `orderTotalCents?: number` — all optional, so the existing `/split` route's rate-based calls are unaffected.
- `splitBill(groupOrderId, { splitType: "proportional", ... })` now succeeds instead of erroring. Consumed by Phase C's `finalizeGroupOrder`.

**This task has two halves, and the first is the one that carries the money.** Adding the `"proportional"` branch (Step 3b) is the small part. Teaching *every* branch to absorb an absolute shared cost (Step 3a) is what closes X-1 — a group order finalized with `splitType: "equal"` is just as capable of under-billing as one using `"proportional"`, so fixing only the new branch would leave the gap open for the split type most groups actually use.

- [ ] **Step 1: Write the failing test**

```typescript
describe("splitBill — proportional", () => {
  it("computes each member's own subtotal plus their proportional share of tax/service charge", async () => {
    // arrange: two active members m-1 (items totaling $30) and m-2 (items
    // totaling $10); serviceChargeRate 10, taxRate 5
    const result = await service.splitBill("go-1", {
      splitType: "proportional",
      serviceChargeRate: 10,
      taxRate: 5,
    });

    expect(result.success).toBe(true);
    const byMember = new Map(result.data!.map((b) => [b.memberId, b]));
    // m-1: subtotal 30, serviceCharge 3 (10% of 30), tax 1.65 (5% of 33)
    expect(byMember.get("m-1")).toEqual(
      expect.objectContaining({ subtotal: 30, serviceCharge: 3, taxAmount: 1.65 }),
    );
    // m-2: subtotal 10, serviceCharge 1, tax 0.55
    expect(byMember.get("m-2")).toEqual(
      expect.objectContaining({ subtotal: 10, serviceCharge: 1, taxAmount: 0.55 }),
    );
  });

  it("no longer returns Unsupported split type for proportional", async () => {
    const result = await service.splitBill("go-1", { splitType: "proportional" });
    expect(result.error).not.toMatch(/Unsupported split type/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts -t "proportional"`
Expected: FAIL — falls into the `else` branch, `success: false`.

- [ ] **Step 3a: Resolve shared costs once, at the top of `splitBill`**

Before the `if/else if` chain, immediately after `serviceChargeRate`/`taxRate` are read, resolve which costing mode applies. Absolute wins; rates are the fallback:

```typescript
      // X-1: finalize supplies the real order's absolute tax/service charge.
      // The /split route still supplies rates. Never both — applying rates on
      // top of an absolute amount double-charges the table.
      const hasAbsoluteSharedCosts =
        splitData.sharedServiceChargeCents !== undefined ||
        splitData.sharedTaxCents !== undefined;

      // Converted to dollars here and nowhere else; every branch below stays
      // in the float-dollar domain splitBill already uses.
      const sharedServiceCharge = (splitData.sharedServiceChargeCents ?? 0) / 100;
      const sharedTax = (splitData.sharedTaxCents ?? 0) / 100;

      const effectiveServiceChargeRate = hasAbsoluteSharedCosts ? 0 : serviceChargeRate;
      const effectiveTaxRate = hasAbsoluteSharedCosts ? 0 : taxRate;
```

Then give each existing branch a defined way to absorb `sharedServiceCharge`/`sharedTax`, replacing its use of `serviceChargeRate`/`taxRate` with the `effective*` values so the rate path is untouched when absolute amounts aren't supplied:

| branch | absorbs shared cost by | rationale |
| --- | --- | --- |
| `individual` / `by_item` | share of subtotal | preserves exactly today's numbers when the shared cost is rate-derived |
| `proportional` | share of subtotal | same formula; see Step 3b for why they coincide |
| `equal` | per head (`/ memberCount`) | matches the branch's own semantics — everything split evenly |
| `custom` | share of the custom amounts | the custom amounts *are* that member's declared share |

Guard the division: when `totalCartAmount === 0` (or, for `custom`, the custom amounts sum to 0), fall back to per-head so a zero-subtotal group cannot produce `NaN` bills. A `NaN` here reaches the database.

- [ ] **Step 3b: Add the `"proportional"` branch**

Insert a new `else if` branch before the final `else` (i.e. between the existing `"custom"` branch and the catch-all), in `GroupOrdersService.ts`:

```typescript
      } else if (splitData.splitType === "proportional") {
        // Each member's item cost is their own; tax/service charge are
        // computed from that same member's own subtotal at the same flat
        // rate every member pays — which is mathematically identical to the
        // "individual" branch above as long as the only shared costs being
        // split are rate-based (%) rather than a flat amount. This branch
        // exists as its own named strategy because a future flat shared cost
        // (e.g. a delivery fee — not yet modeled anywhere in this codebase,
        // see the Phase C finalize plan's "Out of scope" note) would need to
        // be distributed by each member's *share* of the total rather than
        // charged per-head, and that's what "proportional" is reserved for.
        // Until that flat-fee input exists, this computes the same numbers
        // as "individual" — which is correct, not a placeholder.
        for (const member of members) {
          const memberItems = cartItems.filter((item) => item.memberId === member.id);
          const subtotal = memberItems.reduce(
            (sum, item) => sum + cartItemTotalAmount(item),
            0,
          );
          const serviceCharge = (subtotal * serviceChargeRate) / 100;
          const taxAmount = ((subtotal + serviceCharge) * taxRate) / 100;
          const totalAmount = subtotal + serviceCharge + taxAmount;

          splitBillsData.push({
            memberId: member.id,
            subtotal,
            serviceCharge,
            taxAmount,
            totalAmount,
            items: memberItems.map((item) => ({
              cartItemId: item.id,
              menuItemId: item.menuItemId,
              name: "",
              quantity: item.quantity,
              unitPrice: cartItemUnitAmount(item),
              totalPrice: cartItemTotalAmount(item),
            })),
          });
        }
      } else if (
```

(The next line in the file is already `splitData.splitType === "by_item" || splitData.splitType === "individual"` — wait, that condition is earlier in the chain, not after. Insert the new branch as the last `else if` immediately before the file's existing final `else { return { success: false, error: \`Unsupported split type: ${splitData.splitType}\` } }`, so the ordering becomes: `by_item/individual` → `equal` → `custom` → `proportional` (new) → `else` fallback for anything genuinely unhandled.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @makanmasak/api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts
git commit -m "feat(api): implement the proportional group-order split type"
```

---

### Task 2: Rounding-remainder reconciliation

**Files:**
- Modify: `apps/api/src/features/group-orders/services/GroupOrdersService.ts` (in `splitBill`, after `splitBillsData` is fully populated, before the insert loop at line ~1086)
- Test: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`

**Interfaces:**
- No signature change. The creator (`role: "creator"`) member's `split_bills` row absorbs the rounding remainder so `sum(all members' totalAmountCents) === toRequiredCents(finalAmount)` exactly, per design spec decision 6.

- [ ] **Step 1: Write the failing test**

```typescript
it("assigns the rounding remainder to the host so member totals sum exactly to the order total (equal split, 3 members, $100)", async () => {
  // arrange: 3 active members (one with role "creator"), cart items
  // totaling exactly $100.00, splitType "equal", no tax/service charge
  const result = await service.splitBill("go-1", { splitType: "equal" });

  const cents = result.data!.map((b) => Math.round(b.totalAmount * 100));
  const sum = cents.reduce((a, b) => a + b, 0);
  expect(sum).toBe(10000); // not 9999 or 10001 from independent per-member rounding

  const hostBill = result.data!.find((b) => /* the seeded creator's memberId */ true);
  // the two non-host members should be exactly equal to each other; only the
  // host's cents value may differ from theirs by the leftover remainder
});
```

(Write the actual assertion against whichever member id the test's arranged fixture marks as `role: "creator"` — don't leave this as a vague comment in the real test file; the sketch above marks where the local builder's creator id must be threaded through.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts -t "rounding remainder"`
Expected: FAIL — $100.00 / 3 = $33.333..., each independently rounds to $33.33, summing to $99.99, one cent short.

- [ ] **Step 3: Implement**

After the `splitBillsData` array is fully built (i.e. after all of Task 1's `else if` chain, right before the `// Insert split bills into database` comment at line ~1085), add:

```typescript
      // Reconcile independent per-member cent rounding so the sum of every
      // member's totalAmountCents equals the target exactly — the remainder
      // (positive or negative, a handful of cents at most) is absorbed by the
      // creator, not spread arbitrarily or silently dropped.
      //
      // X-1: when finalize supplied the real order total, THAT is the target.
      // Reconciling splitBillsData against its own sum only aligns "round then
      // add" with "add then round"; it cannot detect the split disagreeing
      // with what the customer was actually charged, which is the failure that
      // costs money. Fall back to the internal sum only for the /split route,
      // where no real order exists yet.
      const targetTotalCents =
        splitData.orderTotalCents ??
        toRequiredCents(splitBillsData.reduce((sum, b) => sum + b.totalAmount, 0));
      const roundedTotalCents = splitBillsData.reduce(
        (sum, b) => sum + toRequiredCents(b.totalAmount),
        0,
      );
      const remainderCents = targetTotalCents - roundedTotalCents;
      if (remainderCents !== 0) {
        const creatorBill =
          splitBillsData.find(
            (b) => members.find((m) => m.id === b.memberId)?.role === "creator",
          ) ?? splitBillsData[0];
        creatorBill.totalAmount += remainderCents / 100;
      }
```

**Bound the remainder before absorbing it.** Once the target is an externally supplied `orderTotalCents`, this block will happily hand the creator *any* discrepancy — including one caused by Step 3a failing to distribute the shared costs at all, which would quietly bill the host the entire tax and service charge. Rounding can only ever be off by less than one cent per member, so anything larger is a bug, not a remainder:

```typescript
      if (Math.abs(remainderCents) > splitBillsData.length) {
        // Not a rounding artifact. Something upstream miscomputed the split;
        // billing one member for the difference would hide it.
        this.errorTracker.logError(
          "splitBill",
          new Error("SPLIT_TOTAL_MISMATCH"),
          { groupOrderId, targetTotalCents, roundedTotalCents },
        );
        return {
          success: false,
          error: "Split totals do not reconcile with the order total",
        };
      }
```

Place this before the absorb step. Failing the split loudly is the right outcome: Phase C's finalize has already created the real order at that point, so a mismatch needs a human, not a silent adjustment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @makanmasak/api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.ts \
  apps/api/src/features/group-orders/services/GroupOrdersService.test.ts
git commit -m "fix(api): reconcile per-member rounding remainder in group-order split bills"
```

---

### Task 3: Verify Plan-A manual settlement via the existing `processPayment`

**Files:**
- Test only: `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`

**Interfaces:**
- None new — this task is verification-only, proving `processPayment(groupOrderId, memberId, { paymentMethod: "cash" })` already serves Plan A's "cashier marks it settled" use case, per the group-ordering design spec's decision 5.

- [ ] **Step 1: Write the test**

```typescript
describe("processPayment — Plan A manual settlement", () => {
  it("marks a member's split bill paid with paymentMethod cash and no real gateway involved", async () => {
    // arrange: a split_bills row for memberId "m-1" with totalAmountCents 3300,
    // paymentStatus "pending"
    const result = await service.processPayment("go-1", "m-1", {
      paymentMethod: "cash",
    });

    expect(result.success).toBe(true);
    expect(result.data?.paymentMethod).toBe("cash");
    expect(updateSplitBillsMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: "paid", paymentMethod: "cash" }),
    );
  });

  it("flips the group order to completed once every member's split bill is paid", async () => {
    // arrange: this is the last unpaid split_bills row in the group
    const result = await service.processPayment("go-1", "m-last", {
      paymentMethod: "cash",
    });

    expect(result.data?.groupOrderStatus).toBe("completed");
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @makanmasak/api exec vitest run src/features/group-orders/services/GroupOrdersService.test.ts -t "Plan A manual settlement"`
Expected: PASS immediately — no implementation change needed. If it fails, that means `processPayment` doesn't actually behave as the design spec assumed, and this task becomes "fix `processPayment`" instead of "verify it" — re-read the method (line 1210) against the failure before changing anything.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/group-orders/services/GroupOrdersService.test.ts
git commit -m "test(api): verify processPayment already serves Plan A cash settlement"
```

---

## Self-review notes

- **Spec coverage:** design decision 6 (both split strategies implemented, rounding remainder to host) — Tasks 1-2. Decision 5 (Plan A = calculate + display, settle outside the app) — Task 3, confirmed already true rather than built new.
- **Placeholder scan:** Task 1's `"proportional"` branch is fully implemented, not stubbed — the code comment explains *why* its output currently matches `"individual"`'s, which is a factual statement about the math, not a hidden gap. No TBD/TODO anywhere in this plan.
- **Type consistency:** `splitBill`'s existing return shape (`SplitBillData[]`) is unchanged by either task; the reconciliation in Task 2 mutates `splitBillsData` entries in place before they're used by the (unchanged) insert loop.
- **Honesty about scope:** this phase does not add a flat-fee (e.g. delivery fee) distribution mechanism, because no such fee exists anywhere in the system yet (see Phase C's "Out of scope"). X-1's `sharedServiceChargeCents`/`sharedTaxCents` is the input such a fee would arrive through, and Task 1 Step 3a's per-branch absorption table is where its distribution policy would be chosen — noted so a future implementer extends that rather than building a parallel mechanism.
- **X-1 dependency, both directions:** this phase and Phase C Task 2 are each incomplete without the other. Phase C passes absolute shared costs and an order total down; this phase consumes them. Merging either alone leaves the money gap X-1 describes — Phase C alone under-bills, this phase alone has inputs nobody supplies. The staging in `2026-08-05-group-ordering-bcd-AUDIT.md` puts Tasks 1-2 here *before* Phase C Task 2 so `finalizeGroupOrder` can be written once, against the finished `splitBill` signature.
- **What X-1 does not buy:** it does not make `"proportional"` numerically distinct from `"individual"`. That remains true and is stated in the Global Constraints so nobody reads the new inputs as licence to invent a difference. The tripwire test required by the audit doc (assert the two coincide *while* no non-proportional shared cost exists) is what will force the distinction to be implemented on the day one does.
