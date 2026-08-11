import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "./testing/create-test-database";
import { runCustomerIdentityPreflight } from "./customer-identity-preflight";

describe("customer identity migration preflight", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

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
        (id, username, email, phone, full_name, password_hash, role, is_active,
         is_verified, created_at_ms, updated_at_ms)
       VALUES ('018f0000-0000-7000-8000-000000000555',
         'legacy-a', 'SAME@example.com', '0912-345-678', 'Legacy A',
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

  it("enforces at most one password identity per customer", async () => {
    await testDb.bindings.DB.prepare(
      `INSERT INTO customers
        (id, display_name, created_at_ms, updated_at_ms)
       VALUES ('customer-a', 'Customer A', 1, 1)`,
    ).run();
    await testDb.bindings.DB.prepare(
      `INSERT INTO customer_auth_identities
        (id, customer_id, provider, provider_uid, secret_hash,
         created_at_ms, updated_at_ms)
       VALUES ('identity-a', 'customer-a', 'password', 'a@example.com',
         'hash-a', 1, 1)`,
    ).run();

    await expect(
      testDb.bindings.DB.prepare(
        `INSERT INTO customer_auth_identities
          (id, customer_id, provider, provider_uid, secret_hash,
           created_at_ms, updated_at_ms)
         VALUES ('identity-b', 'customer-a', 'password', 'b@example.com',
           'hash-b', 1, 1)`,
      ).run(),
    ).rejects.toThrow();
  });
});
