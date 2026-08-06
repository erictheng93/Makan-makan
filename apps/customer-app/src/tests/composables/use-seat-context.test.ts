import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSeatContext } from "@/composables/useSeatContext";

const query = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    get query() {
      return query.current;
    },
  }),
}));

function readContext(routeQuery: Record<string, unknown>) {
  query.current = routeQuery;
  let ctx!: ReturnType<typeof useSeatContext>;
  mount(
    defineComponent({
      setup() {
        ctx = useSeatContext();
        return () => null;
      },
    }),
  );
  return {
    seatId: ctx.seatId.value,
    seatNumber: ctx.seatNumber.value,
    seatLabel: ctx.seatLabel.value,
    seatQuery: ctx.seatQuery.value,
  };
}

describe("useSeatContext", () => {
  it("keeps the row id for the order and the printed number for display", () => {
    // Seat "02" on the second table is row 10 — the two must not be conflated.
    expect(readContext({ seatId: "10", seatNumber: "02" })).toEqual({
      seatId: 10,
      seatNumber: "02",
      seatLabel: "02",
      seatQuery: { seatId: "10", seatNumber: "02" },
    });
  });

  it("shows no seat label when only the id is known", () => {
    // Regression guard: this used to render String(seatId).padStart(2,"0"),
    // so a diner at sticker "02" was told they were at "10".
    const ctx = readContext({ seatId: "10" });
    expect(ctx.seatId).toBe(10);
    expect(ctx.seatLabel).toBeNull();
    expect(ctx.seatQuery).toEqual({ seatId: "10" });
  });

  it("ignores a seat number that arrives without an id", () => {
    expect(readContext({ seatNumber: "02" })).toEqual({
      seatId: null,
      seatNumber: "02",
      seatLabel: null,
      seatQuery: undefined,
    });
  });

  it("rejects non-positive and non-integer ids", () => {
    expect(readContext({ seatId: "0", seatNumber: "01" }).seatId).toBeNull();
    expect(readContext({ seatId: "-3", seatNumber: "01" }).seatId).toBeNull();
    expect(readContext({ seatId: "1.5", seatNumber: "01" }).seatId).toBeNull();
    expect(readContext({ seatId: "abc", seatNumber: "01" }).seatId).toBeNull();
  });

  it("takes the first value when the query key is repeated", () => {
    expect(
      readContext({ seatId: ["10", "11"], seatNumber: ["02", "03"] }),
    ).toMatchObject({ seatId: 10, seatLabel: "02" });
  });

  it("treats a blank seat number as absent rather than rendering an empty label", () => {
    expect(readContext({ seatId: "10", seatNumber: "   " })).toMatchObject({
      seatLabel: null,
      seatQuery: { seatId: "10" },
    });
  });

  it("returns no query fragment for a plain table visit", () => {
    expect(readContext({})).toEqual({
      seatId: null,
      seatNumber: null,
      seatLabel: null,
      seatQuery: undefined,
    });
  });
});
