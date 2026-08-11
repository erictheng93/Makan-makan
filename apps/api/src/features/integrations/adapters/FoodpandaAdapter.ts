import type {
  PlatformType,
  PlatformCredentials,
  ParsedPlatformOrder,
  MenuSyncPayload,
  MenuSyncResult,
} from "@makanmasak/shared-types";
import type { PlatformAdapter } from "./PlatformAdapter";

export class FoodpandaAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "foodpanda";

  async verifyWebhook(_request: Request, _secret: string): Promise<boolean> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async refreshToken(
    _credentials: PlatformCredentials,
  ): Promise<PlatformCredentials> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async parseOrder(_payload: unknown): Promise<ParsedPlatformOrder> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async acceptOrder(
    _platformOrderId: string,
    _creds: PlatformCredentials,
  ): Promise<void> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async denyOrder(
    _platformOrderId: string,
    _reason: string,
    _creds: PlatformCredentials,
  ): Promise<void> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async cancelOrder(
    _platformOrderId: string,
    _reason: string,
    _creds: PlatformCredentials,
  ): Promise<void> {
    throw new Error("Foodpanda integration not yet implemented");
  }

  async syncMenu(
    _menuData: MenuSyncPayload,
    _creds: PlatformCredentials,
  ): Promise<MenuSyncResult> {
    throw new Error("Foodpanda integration not yet implemented");
  }
}
