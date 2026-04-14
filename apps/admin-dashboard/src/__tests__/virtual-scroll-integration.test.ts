/**
 * Module integration test: exercises interaction between useVirtualScroll composable
 * and Vue reactive state without HTTP/DB. This is NOT an end-to-end API integration test —
 * it does not hit routes or D1.
 */

import { describe, it, expect } from "vitest";
import { ref, nextTick } from "vue";
import { useVirtualScroll } from "@/composables/useVirtualScroll";

describe("Virtual Scroll Integration Tests", () => {
  describe("useVirtualScroll composable", () => {
    it("should return visible items based on scroll position", async () => {
      const items = ref(
        Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })),
      );

      const {
        visibleItems,
        totalHeight,
        offsetY,
        containerRef: _containerRef,
      } = useVirtualScroll(items, {
        itemHeight: 50,
        buffer: 5,
        containerHeight: 500,
      });

      // Initial state - should show first items + buffer
      expect(visibleItems.value.length).toBeGreaterThan(0);
      expect(visibleItems.value.length).toBeLessThanOrEqual(20); // (500/50) + buffer

      // Total height should be items * itemHeight
      expect(totalHeight.value).toBe(100 * 50); // 5000px

      // Initial offset should be 0
      expect(offsetY.value).toBe(0);
    });

    it("should handle empty items array", () => {
      const items = ref<any[]>([]);

      const { visibleItems, totalHeight } = useVirtualScroll(items, {
        itemHeight: 50,
        containerHeight: 500,
      });

      expect(visibleItems.value.length).toBe(0);
      expect(totalHeight.value).toBe(0);
    });

    it("should support both Ref and array input", () => {
      const itemsArray = Array.from({ length: 50 }, (_, i) => ({ id: i }));

      const { visibleItems: refItems } = useVirtualScroll(ref(itemsArray), {
        itemHeight: 50,
        containerHeight: 500,
      });

      const { visibleItems: arrayItems } = useVirtualScroll(itemsArray, {
        itemHeight: 50,
        containerHeight: 500,
      });

      expect(refItems.value.length).toBe(arrayItems.value.length);
    });

    it("should include item metadata in visible items", () => {
      const items = ref(
        Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Item ${i}` })),
      );

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 50,
        buffer: 2,
        containerHeight: 250,
      });

      const firstItem = visibleItems.value[0];
      expect(firstItem).toHaveProperty("item");
      expect(firstItem).toHaveProperty("index");
      expect(firstItem).toHaveProperty("offsetTop");
      expect(firstItem.item).toHaveProperty("id");
    });
  });

  describe("Virtual Scroll Performance", () => {
    it("should handle large datasets efficiently", () => {
      const items = ref(Array.from({ length: 10000 }, (_, i) => ({ id: i })));

      const startTime = performance.now();

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 50,
        buffer: 10,
        containerHeight: 600,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should initialize in less than 50ms even with 10,000 items
      expect(duration).toBeLessThan(50);

      // Should only render visible items, not all 10,000
      expect(visibleItems.value.length).toBeLessThan(50);
    });

    it("should maintain consistent visible item count", () => {
      const items = ref(Array.from({ length: 1000 }, (_, i) => ({ id: i })));

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 60,
        buffer: 5,
        containerHeight: 600,
      });

      // 當 scrollTop=0 時，buffer 只會加在末端
      // start = max(0, 0 - buffer) = 0
      // end = min(items.length, ceil(containerHeight/itemHeight) + buffer) = 10 + 5 = 15
      const visibleInViewport = Math.ceil(600 / 60); // = 10
      const expectedVisible = visibleInViewport + 5; // 只有末端的 buffer

      // Should be close to expected (may vary by 1-2 due to rounding)
      expect(visibleItems.value.length).toBeGreaterThanOrEqual(
        expectedVisible - 2,
      );
      expect(visibleItems.value.length).toBeLessThanOrEqual(
        expectedVisible + 2,
      );
    });
  });

  describe("Virtual Scroll Edge Cases", () => {
    it("should handle buffer larger than viewport", () => {
      const items = ref(Array.from({ length: 50 }, (_, i) => ({ id: i })));

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 50,
        buffer: 100, // Huge buffer
        containerHeight: 300,
      });

      // Should still work and show items
      expect(visibleItems.value.length).toBeGreaterThan(0);
      // Should not exceed total items
      expect(visibleItems.value.length).toBeLessThanOrEqual(items.value.length);
    });

    it("should handle item height larger than container", () => {
      const items = ref(Array.from({ length: 10 }, (_, i) => ({ id: i })));

      const { visibleItems, totalHeight } = useVirtualScroll(items, {
        itemHeight: 1000, // Much larger than container
        buffer: 1,
        containerHeight: 500,
      });

      // Should show at least 1 item + buffer
      expect(visibleItems.value.length).toBeGreaterThanOrEqual(1);
      expect(totalHeight.value).toBe(10 * 1000);
    });

    it("should handle very small item heights", () => {
      const items = ref(Array.from({ length: 1000 }, (_, i) => ({ id: i })));

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 10, // Very small
        buffer: 5,
        containerHeight: 500,
      });

      // Should show many items due to small height
      // 當 scrollTop=0 時，只有末端的 buffer
      // visible = ceil(500/10) + buffer = 50 + 5 = 55
      const expected = Math.ceil(500 / 10) + 5;
      expect(visibleItems.value.length).toBeGreaterThanOrEqual(expected - 2);
    });
  });

  describe("Virtual Scroll Reactivity", () => {
    it("should update when items change", async () => {
      const items = ref(Array.from({ length: 10 }, (_, i) => ({ id: i })));

      const { visibleItems } = useVirtualScroll(items, {
        itemHeight: 50,
        buffer: 2,
        containerHeight: 250,
      });

      const initialLength = visibleItems.value.length;

      // Add more items
      items.value.push(
        ...Array.from({ length: 90 }, (_, i) => ({ id: i + 10 })),
      );
      await nextTick();

      // Visible items should stay similar (showing first items)
      // but total available items increased
      expect(visibleItems.value.length).toBeGreaterThanOrEqual(
        initialLength - 2,
      );
      expect(items.value.length).toBe(100);
    });

    it("should handle filtered items correctly", async () => {
      const allItems = ref(
        Array.from({ length: 100 }, (_, i) => ({
          id: i,
          active: i % 2 === 0,
        })),
      );

      // Create computed filtered array
      const filteredItems = ref(allItems.value.filter((item) => item.active));

      const { visibleItems, totalHeight } = useVirtualScroll(filteredItems, {
        itemHeight: 50,
        buffer: 5,
        containerHeight: 500,
      });

      // Should only show filtered items
      expect(totalHeight.value).toBe(50 * 50); // 50 active items * 50px
      expect(visibleItems.value.every((vi) => vi.item.active)).toBe(true);
    });
  });
});
