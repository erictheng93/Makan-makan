/**
 * Bundle Service
 *
 * Manages worker bundles stored in R2.
 * Bundles contain the compiled worker script and migration SQL files
 * for a specific version of the application.
 *
 * R2 structure:
 *   bundles/{version}/worker.js     - Compiled worker script
 *   bundles/{version}/migrations.json - Array of {name, sql} migration files
 */

import type { ManagementEnv } from "../types";
import { sortVersionsDescending } from "../utils/semver";

export interface BundleManifest {
  version: string;
  migrations: Array<{ name: string; sql: string }>;
  createdAt: string;
}

export interface Bundle {
  version: string;
  script: string;
  migrations: Array<{ name: string; sql: string }>;
}

export class BundleService {
  private env: ManagementEnv;

  constructor(env: ManagementEnv) {
    this.env = env;
  }

  /**
   * Get a bundle for a specific version
   */
  async getBundle(version: string): Promise<Bundle | null> {
    const [scriptObj, migrationsObj] = await Promise.all([
      this.env.BUNDLE_STORAGE.get(`bundles/${version}/worker.js`),
      this.env.BUNDLE_STORAGE.get(`bundles/${version}/migrations.json`),
    ]);

    if (!scriptObj) return null;

    const script = await scriptObj.text();
    let migrations: Array<{ name: string; sql: string }> = [];

    if (migrationsObj) {
      const migrationsJson = await migrationsObj.text();
      migrations = JSON.parse(migrationsJson);
    }

    return { version, script, migrations };
  }

  /**
   * List available bundle versions
   */
  async listVersions(): Promise<string[]> {
    const listed = await this.env.BUNDLE_STORAGE.list({
      prefix: "bundles/",
      delimiter: "/",
    });

    const versions: string[] = [];
    for (const prefix of listed.delimitedPrefixes || []) {
      // prefix looks like "bundles/1.2.0/"
      const version = prefix.replace("bundles/", "").replace("/", "");
      if (version) versions.push(version);
    }

    return sortVersionsDescending(versions); // Latest first (semver, not lexical)
  }

  /**
   * Upload a bundle (called by CI/CD pipeline)
   */
  async uploadBundle(
    version: string,
    script: string,
    migrations: Array<{ name: string; sql: string }>,
  ): Promise<void> {
    const manifest: BundleManifest = {
      version,
      migrations,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      this.env.BUNDLE_STORAGE.put(`bundles/${version}/worker.js`, script),
      this.env.BUNDLE_STORAGE.put(
        `bundles/${version}/migrations.json`,
        JSON.stringify(migrations),
      ),
      this.env.BUNDLE_STORAGE.put(
        `bundles/${version}/manifest.json`,
        JSON.stringify(manifest),
      ),
    ]);
  }
}
