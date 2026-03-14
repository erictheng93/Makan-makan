export class SearchIndexSyncService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async onMenuItemChanged(menuItemId: number): Promise<void> {
    const item = await this.db
      .prepare(
        `SELECT mi.id, mi.name, mi.price, mi.is_available, mi.tags, mi.keywords,
                mi.deleted_at_ms, mi.restaurant_id, mi.category_id,
                c.name as category_name,
                r.district, r.type as restaurant_type,
                r.supports_takeaway, r.supports_delivery, r.deleted_at_ms as restaurant_deleted
         FROM menu_items mi
         LEFT JOIN categories c ON mi.category_id = c.id
         JOIN restaurants r ON mi.restaurant_id = r.id
         WHERE mi.id = ?`,
      )
      .bind(menuItemId)
      .first<any>();

    if (!item) {
      await this.db
        .prepare("DELETE FROM dish_search_index WHERE menu_item_id = ?")
        .bind(menuItemId)
        .run();
      return;
    }

    const isAvailable =
      item.is_available && !item.deleted_at_ms && !item.restaurant_deleted;
    const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
    const tags = [
      ...(item.tags ? JSON.parse(item.tags) : []),
      ...(item.keywords ? JSON.parse(item.keywords) : []),
    ];

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO dish_search_index
         (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        item.id,
        item.restaurant_id,
        item.name,
        normalized,
        item.category_name,
        item.price,
        isAvailable ? 1 : 0,
        JSON.stringify(tags),
        item.district,
        item.restaurant_type,
        item.supports_takeaway ? 1 : 0,
        item.supports_delivery ? 1 : 0,
        Date.now(),
      )
      .run();
  }

  async onRestaurantChanged(restaurantId: string): Promise<void> {
    const restaurant = await this.db
      .prepare(
        "SELECT district, type, supports_takeaway, supports_delivery, deleted_at_ms FROM restaurants WHERE id = ?",
      )
      .bind(restaurantId)
      .first<any>();

    if (!restaurant) return;

    if (restaurant.deleted_at_ms) {
      await this.db
        .prepare(
          "UPDATE dish_search_index SET is_available = 0, updated_at_ms = ? WHERE restaurant_id = ?",
        )
        .bind(Date.now(), restaurantId)
        .run();
    } else {
      await this.db
        .prepare(
          `UPDATE dish_search_index SET district = ?, restaurant_type = ?,
           supports_takeaway = ?, supports_delivery = ?, updated_at_ms = ?
           WHERE restaurant_id = ?`,
        )
        .bind(
          restaurant.district,
          restaurant.type,
          restaurant.supports_takeaway ? 1 : 0,
          restaurant.supports_delivery ? 1 : 0,
          Date.now(),
          restaurantId,
        )
        .run();
    }

    await this.kv.delete(`search:restaurants:district:${restaurant.district}`);
  }
}
