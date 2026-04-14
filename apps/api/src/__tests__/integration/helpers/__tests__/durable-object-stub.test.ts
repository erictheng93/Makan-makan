import { describe, it, expect } from "vitest";
import { createDurableObjectStub } from "../durable-object-stub";

describe("createDurableObjectStub", () => {
  it("exposes idFromName, idFromString, newUniqueId, and get", () => {
    const stub = createDurableObjectStub();
    expect(typeof stub.idFromName).toBe("function");
    expect(typeof stub.idFromString).toBe("function");
    expect(typeof stub.newUniqueId).toBe("function");
    expect(typeof stub.get).toBe("function");
  });

  it("returns a DO object whose fetch resolves to a 200 empty JSON response", async () => {
    const stub = createDurableObjectStub();
    const id = stub.idFromName("test");
    const obj = stub.get(id);
    const res = await obj.fetch(new Request("https://test/do"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("{}");
  });

  it("newUniqueId returns distinct ids", () => {
    const stub = createDurableObjectStub();
    const a = stub.newUniqueId().toString();
    const b = stub.newUniqueId().toString();
    expect(a).not.toBe(b);
  });
});
