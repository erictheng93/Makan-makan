import { describe, it, expect, afterEach } from "vitest";
import {
  startTestApiServer,
  type TestApiServerHandle,
} from "./helpers/start-test-api-server";

describe("startTestApiServer", () => {
  let handle: TestApiServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await handle.stop();
      handle = null;
    }
  });

  it("listens on a random port and serves /info over real HTTP", async () => {
    handle = await startTestApiServer();
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const res = await fetch(`${handle.url}/info`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("MakanMakan API");
  });

  it("exposes seed.restaurant", async () => {
    handle = await startTestApiServer();
    const r = await handle.seed.restaurant();
    expect(r.id).toBeTruthy();
  });

  it("stop closes the server without hanging", async () => {
    handle = await startTestApiServer();
    await expect(handle.stop()).resolves.not.toThrow();
    handle = null;
  });
});
