import type { MarketListItem } from "@/services/marketsApi";
import { customerIdentityApi } from "@/services/customerIdentityApi";

const FAVORITES_KEY = "makanmakan_favorite_markets";
const RECENTS_KEY = "makanmakan_recent_markets";
const MAX_RECENT_MARKETS = 8;

export interface StoredMarket {
  id: string;
  slug: string;
  name: string;
  type?: string;
  city?: string;
  district?: string;
  address?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  updatedAt: number;
}

function storage() {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

function marketSnapshot(market: MarketListItem): StoredMarket {
  return {
    id: market.id,
    slug: market.slug,
    name: market.name,
    type: market.type,
    city: market.city,
    district: market.district,
    address: market.address,
    bannerUrl: market.bannerUrl,
    logoUrl: market.logoUrl,
    updatedAt: Date.now(),
  };
}

function readMarkets(key: string): StoredMarket[] {
  try {
    const raw = storage()?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is StoredMarket =>
        typeof item?.id === "string" &&
        typeof item.slug === "string" &&
        typeof item.name === "string",
    );
  } catch {
    return [];
  }
}

function writeMarkets(key: string, markets: StoredMarket[]) {
  storage()?.setItem(key, JSON.stringify(markets));
}

export function listFavoriteMarkets() {
  return readMarkets(FAVORITES_KEY);
}

export function isFavoriteMarket(marketId: string) {
  return listFavoriteMarkets().some((market) => market.id === marketId);
}

export function toggleFavoriteMarket(market: MarketListItem) {
  const favorites = listFavoriteMarkets();
  const exists = favorites.some((item) => item.id === market.id);
  const nextFavorites = exists
    ? favorites.filter((item) => item.id !== market.id)
    : [
        marketSnapshot(market),
        ...favorites.filter((item) => item.id !== market.id),
      ];

  writeMarkets(FAVORITES_KEY, nextFavorites);
  return !exists;
}

export function isCustomerFavoriteSyncAvailable() {
  return Boolean(storage()?.getItem("customer_auth_token"));
}

export async function syncFavoriteMarketPreference(
  market: MarketListItem,
  favorited: boolean,
) {
  if (!isCustomerFavoriteSyncAvailable()) return;

  const favorites = await customerIdentityApi.listFavorites("market");
  const existing = favorites.find(
    (favorite) => favorite.targetId === market.id,
  );

  if (favorited && !existing) {
    await customerIdentityApi.addFavorite({
      targetType: "market",
      targetId: market.id,
    });
    return;
  }

  if (!favorited && existing) {
    await customerIdentityApi.removeFavorite(existing.id);
  }
}

export async function hydrateFavoriteMarketsFromIdentity(
  markets: MarketListItem[],
) {
  if (!isCustomerFavoriteSyncAvailable()) return listFavoriteMarkets();

  const favorites = await customerIdentityApi.listFavorites("market");
  const favoriteIds = new Set(favorites.map((favorite) => favorite.targetId));
  const syncedMarkets = markets
    .filter((market) => favoriteIds.has(market.id))
    .map(marketSnapshot);

  writeMarkets(FAVORITES_KEY, mergeFavoriteSnapshots(syncedMarkets));
  return listFavoriteMarkets();
}

export function listRecentMarkets() {
  return readMarkets(RECENTS_KEY);
}

export function recordRecentMarket(market: MarketListItem) {
  const recents = listRecentMarkets();
  const nextRecents = [
    marketSnapshot(market),
    ...recents.filter((item) => item.id !== market.id),
  ].slice(0, MAX_RECENT_MARKETS);

  writeMarkets(RECENTS_KEY, nextRecents);
  return nextRecents;
}

function mergeFavoriteSnapshots(syncedMarkets: StoredMarket[]) {
  const byId = new Map<string, StoredMarket>();
  for (const market of syncedMarkets) {
    byId.set(market.id, market);
  }
  for (const market of listFavoriteMarkets()) {
    if (!byId.has(market.id)) {
      byId.set(market.id, market);
    }
  }
  return Array.from(byId.values());
}
