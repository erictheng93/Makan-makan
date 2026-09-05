import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { platformIntegrations } from "@makanmasak/database";
import type {
  PlatformType,
  PlatformCredentials,
  ConnectPlatformRequest,
  UpdatePlatformConfigRequest,
} from "@makanmasak/shared-types";
import { encrypt, decrypt } from "@makanmasak/utils";
import type { EncryptionOptions } from "@makanmasak/utils";
import {
  encryptionSettings,
  PLATFORM_CREDENTIALS_ENCRYPTION_SALT,
} from "../../../shared/utils/encryption";
import type { Env } from "../../../types/env";

export class PlatformIntegrationService {
  private db;
  private encryptionKey: string;
  private cipher: EncryptionOptions;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    const encryption = encryptionSettings(env);
    this.encryptionKey = encryption.key;
    this.cipher = {
      salt: PLATFORM_CREDENTIALS_ENCRYPTION_SALT,
      requireStrongKey: encryption.requireStrongKey,
    };
  }

  async getIntegrations(restaurantId: string) {
    return this.db
      .select()
      .from(platformIntegrations)
      .where(eq(platformIntegrations.restaurantId, restaurantId));
  }

  async getIntegration(restaurantId: string, platform: PlatformType) {
    const results = await this.db
      .select()
      .from(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.restaurantId, restaurantId),
          eq(platformIntegrations.platform, platform),
        ),
      )
      .limit(1);

    return results[0] ?? null;
  }

  async connect(
    restaurantId: string,
    platform: PlatformType,
    data: ConnectPlatformRequest,
  ) {
    const credentialsPayload: PlatformCredentials = {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      storeId: data.storeId,
    };

    const encryptedCreds = await this.encryptCredentials(
      credentialsPayload,
      this.encryptionKey,
    );

    const existing = await this.getIntegration(restaurantId, platform);

    if (existing) {
      await this.db
        .update(platformIntegrations)
        .set({
          credentials:
            encryptedCreds as unknown as typeof platformIntegrations.$inferInsert.credentials,
          enabled: true,
          config: {
            autoAcceptOrders: data.autoAcceptOrders ?? false,
            menuSyncEnabled: data.menuSyncEnabled ?? false,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(platformIntegrations.restaurantId, restaurantId),
            eq(platformIntegrations.platform, platform),
          ),
        );
    } else {
      await this.db.insert(platformIntegrations).values({
        restaurantId,
        platform,
        credentials:
          encryptedCreds as unknown as typeof platformIntegrations.$inferInsert.credentials,
        enabled: true,
        config: {
          autoAcceptOrders: data.autoAcceptOrders ?? false,
          menuSyncEnabled: data.menuSyncEnabled ?? false,
        },
        menuSyncStatus: "idle",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return this.getIntegration(restaurantId, platform);
  }

  async disconnect(restaurantId: string, platform: PlatformType) {
    await this.db
      .delete(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.restaurantId, restaurantId),
          eq(platformIntegrations.platform, platform),
        ),
      );
  }

  async updateConfig(
    restaurantId: string,
    platform: PlatformType,
    configUpdate: UpdatePlatformConfigRequest,
  ) {
    const existing = await this.getIntegration(restaurantId, platform);
    const { webhookSecret, ...nonSecretConfigUpdate } = configUpdate;
    const currentConfig = (existing?.config ?? {}) as Record<string, unknown>;
    const { webhookSecret: _legacySecret, ...safeCurrentConfig } =
      currentConfig;
    const newConfig = { ...safeCurrentConfig, ...nonSecretConfigUpdate };

    let credentials:
      | typeof platformIntegrations.$inferInsert.credentials
      | undefined;
    if (webhookSecret !== undefined) {
      const currentCredentials = await this.readStoredCredentials(
        existing?.credentials,
      );
      credentials = await this.encryptCredentials(
        { ...currentCredentials, webhookSecret },
        this.encryptionKey,
      );
    }

    await this.db
      .update(platformIntegrations)
      .set({
        config: newConfig as typeof platformIntegrations.$inferInsert.config,
        ...(credentials ? { credentials } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformIntegrations.restaurantId, restaurantId),
          eq(platformIntegrations.platform, platform),
        ),
      );

    return this.getIntegration(restaurantId, platform);
  }

  async getDecryptedCredentials(
    restaurantId: string,
    platform: PlatformType,
  ): Promise<PlatformCredentials> {
    const integration = await this.getIntegration(restaurantId, platform);
    if (!integration) {
      throw new Error(
        `No integration found for ${platform} in restaurant ${restaurantId}`,
      );
    }

    const credentialsStr = integration.credentials as unknown as string;
    return this.readStoredCredentials(credentialsStr);
  }

  async readStoredCredentials(stored: unknown): Promise<PlatformCredentials> {
    if (typeof stored === "string" && stored.length > 0) {
      const storedValue = stored.trim();
      if (storedValue.length === 0) {
        return {};
      }
      if (storedValue.startsWith('"') || storedValue.startsWith("{")) {
        const parsed = JSON.parse(storedValue) as unknown;
        if (typeof parsed === "string") {
          return this.decryptCredentials(parsed, this.encryptionKey);
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as PlatformCredentials;
        }
      }
      return this.decryptCredentials(storedValue, this.encryptionKey);
    }
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      return stored as PlatformCredentials;
    }
    return {};
  }

  /**
   * Credentials are AES-256-GCM over a PBKDF2-derived key, in the shared
   * `base64(iv):base64(ciphertext)` framing from `@makanmasak/utils`.
   *
   * This replaced a local scheme that used `SHA-256(key)` directly as the AES
   * key, with no KDF, and framed the result as one un-separated base64 blob
   * (issue #300). Rows written by that scheme are not readable here and are not
   * meant to be — see `decryptCredentials`.
   */
  async encryptCredentials(
    creds: PlatformCredentials,
    key: string,
  ): Promise<string> {
    return encrypt(JSON.stringify(creds), key, this.cipher);
  }

  async decryptCredentials(
    encrypted: string,
    key: string,
  ): Promise<PlatformCredentials> {
    // The retired scheme produced a single base64 blob; ':' is not in the
    // base64 alphabet, so the two formats are unambiguous. Say so plainly
    // instead of letting AES-GCM fail with an opaque error, or — worse —
    // keeping the no-KDF code path alive to read it.
    if (!encrypted.includes(":")) {
      throw new Error(
        "Stored platform credentials use the retired unsalted encryption " +
          "format and cannot be read. Reconnect the platform to re-encrypt " +
          "them.",
      );
    }

    const plaintext = await decrypt(encrypted, key, this.cipher);
    return JSON.parse(plaintext) as PlatformCredentials;
  }
}
