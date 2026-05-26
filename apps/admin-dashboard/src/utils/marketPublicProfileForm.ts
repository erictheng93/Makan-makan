import type {
  MarketListItem,
  UpdateMarketPublicProfileInput,
} from "@/services/marketsService";

export interface MarketPublicProfileForm {
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  openingHoursText: string;
  bannerUrl: string;
  logoUrl: string;
  imageUrlsText: string;
  tagsText: string;
}

export function marketPublicProfileFormFromMarket(
  market: MarketListItem,
): MarketPublicProfileForm {
  return {
    description: market.description ?? "",
    address: market.address ?? "",
    latitude: market.latitude == null ? "" : String(market.latitude),
    longitude: market.longitude == null ? "" : String(market.longitude),
    openingHoursText: market.openingHours
      ? JSON.stringify(market.openingHours, null, 2)
      : "",
    bannerUrl: market.bannerUrl ?? "",
    logoUrl: market.logoUrl ?? "",
    imageUrlsText: (market.imageUrls ?? []).join("\n"),
    tagsText: (market.tags ?? []).join(", "),
  };
}

export function buildMarketPublicProfilePayload(
  form: MarketPublicProfileForm,
): UpdateMarketPublicProfileInput {
  return {
    description: trimmedOrNull(form.description),
    address: requiredText(form.address, "Address"),
    latitude: parseCoordinate(form.latitude, "Latitude"),
    longitude: parseCoordinate(form.longitude, "Longitude"),
    openingHours: parseOpeningHours(form.openingHoursText),
    bannerUrl: trimmedOrNull(form.bannerUrl),
    logoUrl: trimmedOrNull(form.logoUrl),
    imageUrls: splitLines(form.imageUrlsText),
    tags: splitCommaValues(form.tagsText),
  };
}

function trimmedOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function parseCoordinate(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number`);
  }
  return parsed;
}

function parseOpeningHours(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Opening hours must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Opening hours must be valid JSON");
    }
    throw error;
  }
}

function splitLines(value: string) {
  const items = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function splitCommaValues(value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}
