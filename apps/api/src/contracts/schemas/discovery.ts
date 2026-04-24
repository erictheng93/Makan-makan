/**
 * Discovery API Response Contracts
 *
 * Defines the STABLE response shapes for public discovery endpoints.
 * Customer app search and browse depends on these.
 */

import { z } from "zod";
import { successEnvelope } from "../helpers";
import { MenuItemSchema } from "./menu";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const SearchResponse = successEnvelope(
  z.unknown(), // search results shape varies
);

export const BrowseRestaurantsResponse = successEnvelope(
  z.unknown(), // restaurant listing
);

export const GetRestaurantMenuResponse = successEnvelope(
  z
    .object({
      items: z.array(MenuItemSchema).optional(),
    })
    .passthrough(),
);

export const GetPopularItemsResponse = successEnvelope(z.unknown());

export const ReindexResponse = successEnvelope(z.unknown());
