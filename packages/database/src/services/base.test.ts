import { describe, expect, it, vi } from "vitest";
import { BaseService } from "./base";

class TestService extends BaseService {
  runSafeTransaction(writeFn: (db: unknown) => Promise<unknown>) {
    return this.safeTransaction(writeFn);
  }
}

describe("BaseService.safeTransaction", () => {
  it("fails closed when D1 rejects interactive BEGIN", async () => {
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
    expect(writeFn).not.toHaveBeenCalled();
  });
});
