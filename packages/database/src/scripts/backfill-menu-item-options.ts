import type { D1Database } from "@cloudflare/workers-types";
import { backfillMenuItemOptions } from "../services/menu-options";

export async function runBackfillMenuItemOptions(d1: D1Database) {
  return backfillMenuItemOptions(d1);
}
