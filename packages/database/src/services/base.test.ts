import { describe, expect, it, vi } from "vitest";
import { BaseService } from "./base";

class TestService extends BaseService {
  runSafeTransaction(writeFn: (db: unknown) => Promise<unknown>) {
    return this.safeTransaction(writeFn);
  }

  exposeD1() {
    return this.d1;
  }
}

describe("BaseService.safeTransaction", () => {
  it("fails closed without opening an unsupported D1 transaction", async () => {
    const db = {
      transaction: vi.fn(async () => {
        throw new Error("Failed query: begin");
      }),
    };
    const service = new TestService(db as never, {} as never);
    const writeFn = vi.fn(async () => "written");

    await expect(service.runSafeTransaction(writeFn)).rejects.toThrow(
      "convert this write path to db.batch()",
    );
    expect(db.transaction).not.toHaveBeenCalled();
    expect(writeFn).not.toHaveBeenCalled();
  });
});

describe("BaseService read replication sessions", () => {
  function buildD1() {
    const session = { prepare: vi.fn(), batch: vi.fn(), getBookmark: vi.fn() };
    return {
      d1: {
        prepare: vi.fn(),
        batch: vi.fn(),
        withSession: vi.fn(() => session),
      },
      session,
    };
  }

  it("leaves queries on the primary when no constraint is given", () => {
    const { d1 } = buildD1();

    new TestService(d1 as never, {} as never);

    // The default has to stay bit-for-bit what it was before sessions existed:
    // roughly forty services inherit this constructor, and most of them write.
    expect(d1.withSession).not.toHaveBeenCalled();
  });

  it("opens a session with the given constraint when one is asked for", () => {
    const { d1 } = buildD1();

    new TestService(d1 as never, {} as never, {
      readSessionConstraint: "first-unconstrained",
    });

    expect(d1.withSession).toHaveBeenCalledOnce();
    expect(d1.withSession).toHaveBeenCalledWith("first-unconstrained");
  });

  it("passes a bookmark through unchanged", () => {
    const { d1 } = buildD1();

    // Bookmarks are opaque strings from a previous session's getBookmark();
    // the constraint must not be narrowed to the two named literals or
    // propagating one (#321) would not typecheck.
    new TestService(d1 as never, {} as never, {
      readSessionConstraint: "00000085-0000023b-00004ef8-boo",
    });

    expect(d1.withSession).toHaveBeenCalledWith(
      "00000085-0000023b-00004ef8-boo",
    );
  });

  it("keeps the raw d1 handle on the primary", () => {
    const { d1 } = buildD1();

    const service = new TestService(d1 as never, {} as never, {
      readSessionConstraint: "first-unconstrained",
    });

    // Write paths that reach for this.d1 must not inherit a read session.
    expect(service.exposeD1()).toBe(d1);
  });
});
