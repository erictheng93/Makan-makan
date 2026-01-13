/**
 * Monitoring Storage Service
 * 監控儀表板 - 本地存儲服務（篩選器、佈局等）
 */

import type { SavedFilter, MonitoringFilter } from "@/types/monitoring-filters";
import type { DashboardLayout } from "@/types/monitoring-layout";

const STORAGE_KEYS = {
  FILTERS: "monitoring_saved_filters",
  ACTIVE_FILTER: "monitoring_active_filter",
  LAYOUTS: "monitoring_layouts",
  ACTIVE_LAYOUT: "monitoring_active_layout",
  PREFERENCES: "monitoring_preferences",
};

export class MonitoringStorageService {
  // ========== 篩選器管理 ==========

  /**
   * 獲取所有保存的篩選器
   */
  getSavedFilters(): SavedFilter[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.FILTERS);
      if (!json) return [];

      const filters = JSON.parse(json);
      return filters.map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt),
        filter: this.deserializeFilterData(f.filter),
      }));
    } catch (error) {
      console.error("[Storage] Failed to load filters:", error);
      return [];
    }
  }

  /**
   * 保存篩選器
   */
  saveFilter(
    name: string,
    filter: MonitoringFilter,
    description?: string,
  ): SavedFilter {
    const filters = this.getSavedFilters();

    const newFilter: SavedFilter = {
      id: this.generateId(),
      name,
      description,
      filter,
      isDefault: filters.length === 0, // 第一個篩選器設為默認
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    filters.push(newFilter);
    this.saveSavedFilters(filters);

    return newFilter;
  }

  /**
   * 更新篩選器
   */
  updateFilter(filterId: string, updates: Partial<SavedFilter>): void {
    const filters = this.getSavedFilters();
    const index = filters.findIndex((f) => f.id === filterId);

    if (index > -1) {
      filters[index] = {
        ...filters[index],
        ...updates,
        updatedAt: new Date(),
      };
      this.saveSavedFilters(filters);
    }
  }

  /**
   * 刪除篩選器
   */
  deleteFilter(filterId: string): void {
    const filters = this.getSavedFilters();
    const filtered = filters.filter((f) => f.id !== filterId);
    this.saveSavedFilters(filtered);
  }

  /**
   * 設置默認篩選器
   */
  setDefaultFilter(filterId: string): void {
    const filters = this.getSavedFilters();
    filters.forEach((f) => {
      f.isDefault = f.id === filterId;
    });
    this.saveSavedFilters(filters);
  }

  /**
   * 獲取當前激活的篩選器
   */
  getActiveFilter(): MonitoringFilter | null {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILTER);
      if (!json) return null;
      return this.deserializeFilterData(JSON.parse(json));
    } catch {
      return null;
    }
  }

  /**
   * 設置當前激活的篩選器
   */
  setActiveFilter(filter: MonitoringFilter): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_FILTER, JSON.stringify(filter));
    } catch (error) {
      console.error("[Storage] Failed to save active filter:", error);
    }
  }

  // ========== 佈局管理 ==========

  /**
   * 獲取所有保存的佈局
   */
  getSavedLayouts(): DashboardLayout[] {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.LAYOUTS);
      if (!json) return [];

      const layouts = JSON.parse(json);
      return layouts.map((l: any) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      }));
    } catch (error) {
      console.error("[Storage] Failed to load layouts:", error);
      return [];
    }
  }

  /**
   * 保存佈局
   */
  saveLayout(
    layout: Omit<DashboardLayout, "id" | "createdAt" | "updatedAt">,
  ): DashboardLayout {
    const layouts = this.getSavedLayouts();

    const newLayout: DashboardLayout = {
      ...layout,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    layouts.push(newLayout);
    this.saveSavedLayouts(layouts);

    return newLayout;
  }

  /**
   * 更新佈局
   */
  updateLayout(layoutId: string, updates: Partial<DashboardLayout>): void {
    const layouts = this.getSavedLayouts();
    const index = layouts.findIndex((l) => l.id === layoutId);

    if (index > -1) {
      layouts[index] = {
        ...layouts[index],
        ...updates,
        updatedAt: new Date(),
      };
      this.saveSavedLayouts(layouts);
    }
  }

  /**
   * 刪除佈局
   * 注意：系統佈局不能被刪除
   */
  deleteLayout(layoutId: string): void {
    const layouts = this.getSavedLayouts();
    // Keep layouts that either don't match the ID OR are system layouts
    const filtered = layouts.filter((l) => l.id !== layoutId || l.isSystem);
    this.saveSavedLayouts(filtered);
  }

  /**
   * 設置默認佈局
   */
  setDefaultLayout(layoutId: string): void {
    const layouts = this.getSavedLayouts();
    layouts.forEach((l) => {
      l.isDefault = l.id === layoutId;
    });
    this.saveSavedLayouts(layouts);
  }

  /**
   * 獲取當前激活的佈局
   */
  getActiveLayout(): DashboardLayout | null {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.ACTIVE_LAYOUT);
      if (!json) return null;

      const layout = JSON.parse(json);
      return {
        ...layout,
        createdAt: new Date(layout.createdAt),
        updatedAt: new Date(layout.updatedAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * 設置當前激活的佈局
   */
  setActiveLayout(layout: DashboardLayout): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LAYOUT, JSON.stringify(layout));
    } catch (error) {
      console.error("[Storage] Failed to save active layout:", error);
    }
  }

  // ========== 偏好設置 ==========

  /**
   * 獲取用戶偏好設置
   */
  getPreferences(): Record<string, any> {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return json ? JSON.parse(json) : {};
    } catch {
      return {};
    }
  }

  /**
   * 更新用戶偏好設置
   */
  updatePreferences(updates: Record<string, any>): void {
    try {
      const current = this.getPreferences();
      const updated = { ...current, ...updates };
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
    } catch (error) {
      console.error("[Storage] Failed to save preferences:", error);
    }
  }

  // ========== 工具方法 ==========

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 保存篩選器列表
   */
  private saveSavedFilters(filters: SavedFilter[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
    } catch (error) {
      console.error("[Storage] Failed to save filters:", error);
    }
  }

  /**
   * 保存佈局列表
   */
  private saveSavedLayouts(layouts: DashboardLayout[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAYOUTS, JSON.stringify(layouts));
    } catch (error) {
      console.error("[Storage] Failed to save layouts:", error);
    }
  }

  /**
   * 反序列化篩選器數據
   */
  private deserializeFilterData(data: any): MonitoringFilter {
    return {
      ...data,
      customDateRange: data.customDateRange
        ? {
            start: new Date(data.customDateRange.start),
            end: new Date(data.customDateRange.end),
          }
        : undefined,
    };
  }

  /**
   * 清除所有存儲數據
   */
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  /**
   * 導出所有數據（用於備份）
   */
  exportData(): string {
    const data = {
      filters: this.getSavedFilters(),
      layouts: this.getSavedLayouts(),
      preferences: this.getPreferences(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 導入數據（從備份恢復）
   */
  importData(json: string): boolean {
    try {
      const data = JSON.parse(json);

      if (data.filters) {
        this.saveSavedFilters(data.filters);
      }

      if (data.layouts) {
        this.saveSavedLayouts(data.layouts);
      }

      if (data.preferences) {
        localStorage.setItem(
          STORAGE_KEYS.PREFERENCES,
          JSON.stringify(data.preferences),
        );
      }

      return true;
    } catch (error) {
      console.error("[Storage] Failed to import data:", error);
      return false;
    }
  }
}

// 創建單例實例
export const monitoringStorage = new MonitoringStorageService();
