import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./seed-helper";
import type { TestDatabase } from "@makanmakan/database/testing";

type TestNodeServer = {
  address(): AddressInfo | string | null;
  close(callback: (err: Error | null) => void): void;
};

export interface TestApiServerHandle {
  url: string;
  testDb: TestDatabase;
  authHelper: RealIntegrationTestApp["authHelper"];
  seed: SeedHelpers;
  stop(): Promise<void>;
}

export async function startTestApiServer(
  options: { port?: number } = {},
): Promise<TestApiServerHandle> {
  const testApp = await createRealIntegrationTestApp();

  const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
    const s = serve(
      {
        fetch: testApp.app.fetch,
        port: options.port ?? 0,
      },
      () => resolve(s),
    );
  });

  const address = (
    server as unknown as TestNodeServer
  ).address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    testDb: testApp.testDb,
    authHelper: testApp.authHelper,
    seed: buildSeedHelpers(testApp.testDb),
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        (server as unknown as TestNodeServer).close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await testApp.dispose();
    },
  };
}
