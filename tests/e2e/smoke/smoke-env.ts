export interface SmokeUser {
  restaurantId?: string | null;
}

export interface SmokeLoginData {
  token?: string;
  refreshToken?: string;
  user?: SmokeUser;
}

interface SmokeLoginBody {
  success: boolean;
  data?: SmokeLoginData;
}

interface SmokeMenuItem {
  id?: number | string;
  isAvailable?: boolean | number;
}

interface SmokeMenuBody {
  success: boolean;
  data?: {
    menuItems?: SmokeMenuItem[];
    items?: SmokeMenuItem[];
    categories?: Array<{ items?: SmokeMenuItem[] }>;
  };
}

interface SmokeRestaurantBody {
  success: boolean;
  data?: {
    settings?: {
      allowGuestOrders?: boolean;
    } | null;
  };
}

export interface SmokeFixtureIds {
  restaurantId?: string;
  menuItemId?: number;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

export function isLocalSmokeApi(apiUrl: string): boolean {
  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function localAdminUrlFallback(apiUrl: string): string | undefined {
  return isLocalSmokeApi(apiUrl) ? "http://localhost:3001" : undefined;
}

export async function smokeLogin(
  apiUrl: string,
  username: string,
  password: string,
): Promise<SmokeLoginData> {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`smoke login failed with status ${response.status}`);
  }

  const body = (await response.json()) as SmokeLoginBody;
  if (!body.success || !body.data?.token || !body.data.user) {
    throw new Error("smoke login response did not include token and user");
  }

  return body.data;
}

export function firstAvailableMenuItemId(
  menu: SmokeMenuBody,
): number | undefined {
  const items = [
    ...(menu.data?.menuItems ?? []),
    ...(menu.data?.items ?? []),
    ...(menu.data?.categories ?? []).flatMap(
      (category) => category.items ?? [],
    ),
  ];

  const availableItem = items.find(
    (item) => item.isAvailable !== false && item.isAvailable !== 0,
  );
  const id = Number(availableItem?.id);
  return Number.isFinite(id) ? id : undefined;
}

async function discoverMenuItemId(
  apiUrl: string,
  restaurantId: string,
): Promise<number | undefined> {
  const response = await fetch(`${apiUrl}/api/v1/menu/${restaurantId}`);
  if (!response.ok) return undefined;
  return firstAvailableMenuItemId((await response.json()) as SmokeMenuBody);
}

async function guestOrdersEnabled(
  apiUrl: string,
  restaurantId: string,
): Promise<boolean> {
  const response = await fetch(`${apiUrl}/api/v1/restaurants/${restaurantId}`);
  if (!response.ok) return false;

  const body = (await response.json()) as SmokeRestaurantBody;
  return body.success && body.data?.settings?.allowGuestOrders === true;
}

export async function resolveLocalSmokeFixtureIds(params: {
  apiUrl: string;
  authUsername?: string;
  authPassword?: string;
  restaurantId?: string;
  menuItemId?: number;
  loginData?: SmokeLoginData;
}): Promise<SmokeFixtureIds> {
  const fixtureIds: SmokeFixtureIds = {
    restaurantId: params.restaurantId,
    menuItemId: params.menuItemId,
  };

  if (!isLocalSmokeApi(params.apiUrl)) {
    return fixtureIds;
  }

  if (!fixtureIds.restaurantId) {
    if (!params.authUsername || !params.authPassword) {
      return fixtureIds;
    }

    let loginData = params.loginData;
    if (!loginData) {
      try {
        loginData = await smokeLogin(
          params.apiUrl,
          params.authUsername,
          params.authPassword,
        );
      } catch {
        return fixtureIds;
      }
    }

    fixtureIds.restaurantId = loginData.user?.restaurantId ?? undefined;
  }

  if (
    fixtureIds.restaurantId &&
    !(await guestOrdersEnabled(params.apiUrl, fixtureIds.restaurantId))
  ) {
    return {
      restaurantId: undefined,
      menuItemId: undefined,
    };
  }

  if (fixtureIds.restaurantId && fixtureIds.menuItemId === undefined) {
    fixtureIds.menuItemId = await discoverMenuItemId(
      params.apiUrl,
      fixtureIds.restaurantId,
    );
  }

  return fixtureIds;
}
