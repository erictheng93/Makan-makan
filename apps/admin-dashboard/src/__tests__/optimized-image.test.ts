/**
 * OptimizedImage 組件集成測試
 *
 * 測試目標：
 * 1. 格式檢測功能
 * 2. Cloudflare Images URL 生成
 * 3. 響應式圖片 (srcset) 生成
 * 4. 質量自動調整
 * 5. 懶加載整合
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import OptimizedImage from "@/components/OptimizedImage.vue";
import {
  getFormatSupport,
  getBestFormat,
  buildCloudflareImageURL,
  calculateOptimalQuality,
  generateSrcset,
  type ImageFormat,
  type ImageOptimizationOptions,
} from "@/composables/useOptimizedImage";

// Mock Image 類別以正確處理 jsdom 環境中的格式檢測
// jsdom 的 Image 不會為 data URIs 觸發 onload/onerror
class MockImage {
  private _src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // 模擬瀏覽器行為：在 src 設置後異步觸發事件
    setTimeout(() => {
      // WebP 和 AVIF 的測試 data URI 會成功加載
      if (
        value.includes("data:image/webp") ||
        value.includes("data:image/avif")
      ) {
        this.onload?.();
      } else if (value.startsWith("data:image/")) {
        // 其他 data URI 格式也成功
        this.onload?.();
      } else if (value.includes("invalid") || value.includes("error")) {
        // 模擬錯誤
        this.onerror?.();
      } else {
        // 其他情況默認成功
        this.onload?.();
      }
    }, 0);
  }
}

describe("OptimizedImage Component", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.clearAllMocks();
    // 替換全局 Image 類別
    (globalThis as any).Image = MockImage;
  });

  afterEach(() => {
    // 恢復原始 Image 類別
    globalThis.Image = originalImage;
  });

  describe("Component Rendering", () => {
    it("should render image with basic props", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/test-image.jpg",
          alt: "Test Image",
          width: 600,
          height: 400,
        },
      });

      await nextTick();

      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      expect(img.attributes("alt")).toBe("Test Image");
    });

    it("should apply lazy loading by default", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/test-image.jpg",
          alt: "Test Image",
        },
      });

      await nextTick();

      const img = wrapper.find("img");
      expect(img.attributes("loading")).toBe("lazy");
    });

    it("should disable lazy loading when lazy=false", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/test-image.jpg",
          alt: "Test Image",
          lazy: false,
        },
      });

      await nextTick();

      const img = wrapper.find("img");
      expect(img.attributes("loading")).toBe("eager");
    });

    it("should apply custom CSS classes", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/test-image.jpg",
          alt: "Test Image",
          imageClass: "custom-class rounded-lg",
        },
      });

      await nextTick();

      const img = wrapper.find("img");
      expect(img.classes()).toContain("custom-class");
      expect(img.classes()).toContain("rounded-lg");
    });

    it("should show error fallback on image load failure", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/invalid-image.jpg",
          alt: "Invalid Image",
        },
      });

      // Simulate error event
      const img = wrapper.find("img");
      await img.trigger("error");
      await nextTick();

      // Check if error fallback is shown
      const errorDiv = wrapper.find(".optimized-image-error");
      expect(errorDiv.exists()).toBe(true);
    });
  });

  describe("Format Detection", () => {
    it("should detect browser format support", async () => {
      // 重新導入模組以獲取新的快取狀態
      vi.resetModules();
      const { getFormatSupport: freshGetFormatSupport } =
        await import("@/composables/useOptimizedImage");

      const support = await freshGetFormatSupport();

      expect(support).toHaveProperty("avif");
      expect(support).toHaveProperty("webp");
      expect(support).toHaveProperty("jpeg");
      expect(support).toHaveProperty("png");

      // JPEG and PNG should always be supported
      expect(support.jpeg).toBe(true);
      expect(support.png).toBe(true);
      // 我們的 MockImage 會讓 AVIF 和 WebP 都成功
      expect(support.avif).toBe(true);
      expect(support.webp).toBe(true);
    });

    it("should return best format based on browser support", async () => {
      // 重新導入模組以獲取新的快取狀態
      vi.resetModules();
      const { getBestFormat: freshGetBestFormat } =
        await import("@/composables/useOptimizedImage");

      const format = await freshGetBestFormat("auto");

      // Should return one of the supported formats (在 MockImage 環境下會選擇 avif)
      expect(["avif", "webp", "jpeg"]).toContain(format);
    });

    it("should respect preferred format when specified", async () => {
      const format = await getBestFormat("jpeg");
      expect(format).toBe("jpeg");
    });
  });

  describe("Cloudflare Images URL Generation", () => {
    const accountHash = "test-account-hash";
    const imageId = "test-image-id";

    it("should build basic Cloudflare Images URL", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        height: 400,
      };

      const url = buildCloudflareImageURL(
        accountHash,
        imageId,
        options,
        "webp",
      );

      expect(url).toContain(accountHash);
      expect(url).toContain(imageId);
      expect(url).toContain("w=600");
      expect(url).toContain("h=400");
      expect(url).toContain("format=webp");
    });

    it("should include fit mode in URL", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        fit: "cover",
      };

      const url = buildCloudflareImageURL(
        accountHash,
        imageId,
        options,
        "webp",
      );

      expect(url).toContain("fit=cover");
    });

    it("should include gravity for crop fit", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        fit: "crop",
        gravity: "center",
      };

      const url = buildCloudflareImageURL(
        accountHash,
        imageId,
        options,
        "webp",
      );

      expect(url).toContain("gravity=center");
    });

    it("should include quality parameter", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        quality: 90,
      };

      const url = buildCloudflareImageURL(
        accountHash,
        imageId,
        options,
        "webp",
      );

      expect(url).toContain("quality=90");
    });

    it("should include DPR for retina displays", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        dpr: 2,
      };

      const url = buildCloudflareImageURL(
        accountHash,
        imageId,
        options,
        "webp",
      );

      expect(url).toContain("dpr=2");
    });
  });

  describe("Quality Optimization", () => {
    it("should calculate optimal quality for AVIF", () => {
      const quality = calculateOptimalQuality("avif", 1920, 1080);
      expect(quality).toBeLessThan(85);
      expect(quality).toBeGreaterThan(0);
    });

    it("should calculate optimal quality for WebP", () => {
      const quality = calculateOptimalQuality("webp", 800, 600);
      expect(quality).toBeGreaterThanOrEqual(80);
      expect(quality).toBeLessThanOrEqual(90);
    });

    it("should calculate optimal quality for JPEG", () => {
      const quality = calculateOptimalQuality("jpeg", 600, 400);
      expect(quality).toBeGreaterThanOrEqual(75);
      expect(quality).toBeLessThanOrEqual(85);
    });

    it("should use default quality for unknown dimensions", () => {
      const quality = calculateOptimalQuality("jpeg", undefined, undefined);
      expect(quality).toBe(85);
    });

    it("should adjust quality based on image size", () => {
      const smallQuality = calculateOptimalQuality("avif", 300, 200);
      const largeQuality = calculateOptimalQuality("avif", 2000, 2000);

      // Smaller images should have higher quality
      expect(smallQuality).toBeGreaterThan(largeQuality);
    });
  });

  describe("Responsive Images (srcset)", () => {
    const accountHash = "test-account-hash";
    const imageId = "test-image-id";

    it("should generate srcset with multiple widths", () => {
      const options: ImageOptimizationOptions = {
        width: 800,
      };

      const srcset = generateSrcset(accountHash, imageId, options, "webp");

      // Should contain multiple width variants
      expect(srcset).toContain("400w"); // 0.5x
      expect(srcset).toContain("800w"); // 1x
      expect(srcset).toContain("1200w"); // 1.5x
      expect(srcset).toContain("1600w"); // 2x
    });

    it("should generate proper srcset URLs", () => {
      const options: ImageOptimizationOptions = {
        width: 600,
        height: 400,
      };

      const srcset = generateSrcset(accountHash, imageId, options, "webp");

      // Should contain account hash and image ID
      expect(srcset).toContain(accountHash);
      expect(srcset).toContain(imageId);
    });
  });

  describe("Event Handling", () => {
    it("should emit load event when image loads", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/test-image.jpg",
          alt: "Test Image",
        },
      });

      const img = wrapper.find("img");
      await img.trigger("load");

      expect(wrapper.emitted("load")).toBeTruthy();
      expect(wrapper.emitted("load")?.length).toBe(1);
    });

    it("should emit error event when image fails", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/invalid-image.jpg",
          alt: "Invalid Image",
        },
      });

      const img = wrapper.find("img");
      await img.trigger("error");

      expect(wrapper.emitted("error")).toBeTruthy();
      expect(wrapper.emitted("error")?.length).toBe(1);
    });

    it("should emit formatDetected event with detected format", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          accountHash: "test-hash",
          imageId: "test-id",
          src: "/test-image.jpg",
          alt: "Test Image",
          format: "auto",
        },
      });

      // Wait for format detection
      await new Promise((resolve) => setTimeout(resolve, 100));
      await nextTick();

      const img = wrapper.find("img");
      await img.trigger("load");

      // Format should be detected and emitted
      expect(wrapper.emitted("formatDetected")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("should handle local images without Cloudflare processing", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          src: "/local-image.jpg",
          alt: "Local Image",
        },
      });

      await nextTick();

      const img = wrapper.find("img");
      expect(img.attributes("src")).toBe("/local-image.jpg");
      expect(img.attributes("srcset")).toBeUndefined();
    });

    it("should only generate srcset for Cloudflare images", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          accountHash: "test-hash",
          imageId: "test-id",
          src: "/test-image.jpg",
          alt: "Test Image",
          generateSrcset: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await nextTick();

      const img = wrapper.find("img");
      // Should have srcset for Cloudflare images
      expect(img.attributes("srcset")).toBeDefined();
    });

    it("should not generate srcset when generateSrcset=false", async () => {
      const wrapper = mount(OptimizedImage, {
        props: {
          accountHash: "test-hash",
          imageId: "test-id",
          src: "/test-image.jpg",
          alt: "Test Image",
          generateSrcset: false,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await nextTick();

      const img = wrapper.find("img");
      expect(img.attributes("srcset")).toBeUndefined();
    });
  });
});

describe("Image Optimization Integration", () => {
  it("should work with MenuView menu items", async () => {
    const wrapper = mount(OptimizedImage, {
      props: {
        src: "/menu-item-image.jpg",
        alt: "Menu Item",
        width: 600,
        height: 400,
        format: "auto",
        fit: "cover",
        lazy: true,
        fadeIn: true,
        imageClass: "w-full h-48 object-cover rounded-t-lg",
      },
    });

    await nextTick();

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.classes()).toContain("w-full");
    expect(img.classes()).toContain("h-48");
    expect(img.classes()).toContain("object-cover");
    expect(img.classes()).toContain("rounded-t-lg");
  });
});
