import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { platformIntegrations } from "@makanmakan/database";
import type {
  PlatformType,
  PlatformCredentials,
  ConnectPlatformRequest,
  UpdatePlatformConfigRequest,
} from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";

export class PlatformIntegrationService {
  private db;
  private encryptionKey: string;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    this.encryptionKey = env.ENCRYPTION_KEY;
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
    const encryptedCredentials = await this.encryptCredentials(
      data.credentials,
      this.encryptionKey,
    );

    const existing = await this.getIntegration(restaurantId, platform);

    if (existing) {
      await this.db
        .update(platformIntegrations)
        .set({
          encryptedCredentials,
          storeId: data.storeId,
          isActive: true,
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
        storeId: data.storeId,
        encryptedCredentials,
        isActive: true,
        autoAcceptOrders: false,
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
    config: UpdatePlatformConfigRequest,
  ) {
    await this.db
      .update(platformIntegrations)
      .set({
        ...config,
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

    return this.decryptCredentials(
      integration.encryptedCredentials,
      this.encryptionKey,
    );
  }

  async encryptCredentials(
    creds: PlatformCredentials,
    key: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(creds));

    const keyHash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      plaintext,
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decryptCredentials(
    encrypted: string,
    key: string,
  ): Promise<PlatformCredentials> {
    const encoder = new TextEncoder();

    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const keyHash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext,
    );

    const decoded = new TextDecoder().decode(plaintext);
    return JSON.parse(decoded) as PlatformCredentials;
  }
}
