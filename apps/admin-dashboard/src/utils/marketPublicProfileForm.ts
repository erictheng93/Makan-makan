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
  mapTitle: string;
  mapDescription: string;
  mapImageUrl: string;
  mapWidth: string;
  mapHeight: string;
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
    mapTitle: market.mapLayout?.title ?? "",
    mapDescription: market.mapLayout?.description ?? "",
    mapImageUrl: market.mapLayout?.imageUrl ?? "",
    mapWidth:
      market.mapLayout?.width == null ? "" : String(market.mapLayout.width),
    mapHeight:
      market.mapLayout?.height == null ? "" : String(market.mapLayout.height),
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
    mapLayout: buildMapLayout(form),
    bannerUrl: trimmedOrNull(form.bannerUrl),
    logoUrl: trimmedOrNull(form.logoUrl),
    imageUrls: splitLines(form.imageUrlsText),
    tags: splitCommaValues(form.tagsText),
  };
}

function buildMapLayout(form: MarketPublicProfileForm) {
  const title = trimmedOrNull(form.mapTitle);
  const description = trimmedOrNull(form.mapDescription);
  const imageUrl = trimmedOrNull(form.mapImageUrl);
  const width = parseOptionalPositiveInteger(form.mapWidth, "Map width");
  const height = parseOptionalPositiveInteger(form.mapHeight, "Map height");

  if (!title && !description && !imageUrl && !width && !height) {
    return null;
  }

  return {
    title,
    description,
    imageUrl,
    width,
    height,
  };
}

function trimmedOrNull(value: string | number | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(
  value: string | number | null | undefined,
  label: string,
) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function parseCoordinate(value: string | number, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number`);
  }
  return parsed;
}

function parseOpeningHours(value: string | number | null | undefined) {
  const trimmed = String(value ?? "").trim();
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

function parseOptionalPositiveInteger(
  value: string | number | null | undefined,
  label: string,
) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function splitLines(value: string | number | null | undefined) {
  const items = String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function splitCommaValues(value: string | number | null | undefined) {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}
