import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "./testing/create-test-database";
import { runCustomerIdentityPreflight } from "./customer-identity-preflight";

describe("customer identity migration preflight", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("detects duplicate phones and emails across legacy users and customers", async () => {
    await testDb.bindings.DB.prepare(
      `INSERT INTO customers
        (id, display_name, primary_phone, primary_email, created_at_ms, updated_at_ms)
       VALUES ('customer-a', 'Customer A', '+886912345678', 'same@example.com', 1, 1)`,
    ).run();
    await testDb.bindings.DB.prepare(
      `INSERT INTO users
        (username, email, phone, full_name, password_hash, role, is_active,
         is_verified, created_at_ms, updated_at_ms)
       VALUES ('legacy-a', 'SAME@example.com', '0912-345-678', 'Legacy A',
         'hash', 5, 1, 1, 1, 1)`,
    ).run();

    const report = await runCustomerIdentityPreflight(testDb.bindings.DB);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "duplicate_phone",
          value: "+886912345678",
        }),
        expect.objectContaining({
          type: "duplicate_email",
          value: "same@example.com",
        }),
      ]),
    );
  });
});
