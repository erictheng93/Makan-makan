import { describe, expect, it, vi } from "vitest";
import { CloudflareApiClient } from "./CloudflareApiClient";
import type { ManagementEnv } from "../types";

const env = {} as ManagementEnv;

const jsonResponse = (body: unknown, init: Partial<Response> = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: init.statusText ?? "OK",
  headers:
    init.headers ??
    new Headers({
      etag: "worker-etag",
      "content-type": "application/javascript",
    }),
  json: async () => body,
});

describe("CloudflareApiClient", () => {
  it("verifies tokens from the account lookup response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: false }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CloudflareApiClient(env);

    await expect(client.verifyToken("token", "account")).resolves.toBe(true);
    await expect(client.verifyToken("token", "account")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });

  it("reports detailed token permissions from Cloudflare endpoint checks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(jsonResponse({ success: false }))
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockRejectedValueOnce(new Error("pages unavailable"))
        .mockResolvedValueOnce(jsonResponse({ success: true })),
    );
    const client = new CloudflareApiClient(env);

    await expect(
      client.verifyTokenWithPermissions("token", "account"),
    ).resolves.toEqual({
      valid: true,
      permissions: {
        workers: true,
        d1: false,
        kv: true,
        r2: false,
        pages: true,
      },
    });
  });

  it("returns provider errors when creating D1 databases fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: false,
        errors: [{ message: "name already exists" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new CloudflareApiClient(env);

    await expect(
      client.createD1Database("token", "account", "tenant-db"),
    ).resolves.toEqual({
      success: false,
      error: "name already exists",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account/d1/database",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "tenant-db" }),
      }),
    );
  });

  it("uploads worker modules with metadata bindings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CloudflareApiClient(env);

    await expect(
      client.deployWorker("token", "account", "tenant-worker", "export {};", [
        { type: "kv_namespace", name: "CACHE", namespace_id: "kv-id" },
      ]),
    ).resolves.toEqual({ success: true });

    const [, request] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account/workers/scripts/tenant-worker",
    );
    expect(request).toMatchObject({
      method: "PUT",
      headers: { Authorization: "Bearer token" },
    });
    expect(request.body).toBeInstanceOf(FormData);
  });

  it("returns worker metadata headers and preserves HTTP failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({}, { ok: false, status: 404, statusText: "Not Found" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new CloudflareApiClient(env);

    await expect(
      client.getWorkerInfo("token", "account", "tenant-worker"),
    ).resolves.toEqual({
      success: true,
      info: {
        etag: "worker-etag",
        contentType: "application/javascript",
      },
    });
    await expect(
      client.getWorkerInfo("token", "account", "missing-worker"),
    ).resolves.toEqual({
      success: false,
      error: "HTTP 404: Not Found",
    });
  });
});
