import type {
  PlatformType,
  PlatformCredentials,
  ParsedPlatformOrder,
  MenuSyncPayload,
  MenuSyncResult,
} from "@makanmakan/shared-types";
import { UberEatsAdapter } from "./UberEatsAdapter";
import { FoodpandaAdapter } from "./FoodpandaAdapter";

export interface PlatformAdapter {
  readonly platform: PlatformType;
  verifyWebhook(request: Request, secret: string): Promise<boolean>;
  refreshToken(credentials: PlatformCredentials): Promise<PlatformCredentials>;
  parseOrder(payload: unknown): Promise<ParsedPlatformOrder>;
  acceptOrder(
    platformOrderId: string,
    creds: PlatformCredentials,
  ): Promise<void>;
  denyOrder(
    platformOrderId: string,
    reason: string,
    creds: PlatformCredentials,
  ): Promise<void>;
  cancelOrder(
    platformOrderId: string,
    reason: string,
    creds: PlatformCredentials,
  ): Promise<void>;
  syncMenu(
    menuData: MenuSyncPayload,
    creds: PlatformCredentials,
  ): Promise<MenuSyncResult>;
}

const adapters: Record<string, () => PlatformAdapter> = {
  uber_eats: () => new UberEatsAdapter(),
  foodpanda: () => new FoodpandaAdapter(),
};

export function getAdapter(platform: PlatformType): PlatformAdapter {
  const factory = adapters[platform];
  if (!factory) throw new Error(`Unsupported platform: ${platform}`);
  return factory();
}
