// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImageUpload } from "./useImageUpload";

vi.mock("@/utils/authTokenProvider", () => ({
  setAuthTokenProvider: vi.fn(),
  getAuthToken: () => "admin-token",
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("useImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_IMAGE_API_URL", "http://localhost:8790");
    globalThis.fetch = vi.fn();
  });

  it("rejects unsupported file types without sending a request", async () => {
    const uploader = useImageUpload();
    const file = new File(["not an image"], "menu.pdf", {
      type: "application/pdf",
    });

    const result = await uploader.upload(file);

    expect(result).toBeNull();
    expect(uploader.state.value).toBe("error");
    expect(uploader.errorMessage.value).toBe("menu.upload.invalidType");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects files larger than 10MB without sending a request", async () => {
    const uploader = useImageUpload();
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });

    const result = await uploader.upload(file);

    expect(result).toBeNull();
    expect(uploader.state.value).toBe("error");
    expect(uploader.errorMessage.value).toBe("menu.upload.fileTooLarge");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uploads a valid image and keeps only supported variants", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "image-1",
          variants: {
            thumbnail: "https://cdn.example/thumb.webp",
            small: "https://cdn.example/small.webp",
            medium: "https://cdn.example/medium.webp",
            large: "https://cdn.example/large.webp",
            original: "https://cdn.example/original.webp",
          },
        },
      }),
    } as Response);
    const uploader = useImageUpload();
    const file = new File(["jpeg bytes"], "menu.jpg", {
      type: "image/jpeg",
    });

    const result = await uploader.upload(file);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8790/images/upload?category=menu",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
        }),
        body: expect.any(FormData),
      }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect((request.body as FormData).get("file")).toBe(file);
    expect((request.body as FormData).get("medium")).toBe(file);
    expect((request.body as FormData).get("thumbnail")).toBe(file);
    expect(result).toEqual({
      imageId: "image-1",
      imageUrl: "https://cdn.example/medium.webp",
      imageVariants: {
        thumbnail: "https://cdn.example/thumb.webp",
        small: "https://cdn.example/small.webp",
        medium: "https://cdn.example/medium.webp",
        large: "https://cdn.example/large.webp",
      },
    });
    expect(uploader.result.value).toEqual(result);
    expect(uploader.state.value).toBe("success");
  });

  it("enters error state when the upload request fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false }),
    } as Response);
    const uploader = useImageUpload();
    const file = new File(["png bytes"], "menu.png", {
      type: "image/png",
    });

    const result = await uploader.upload(file);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8790/images/upload?category=menu",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
        }),
        body: expect.any(FormData),
      }),
    );
    expect(result).toBeNull();
    expect(uploader.state.value).toBe("error");
    expect(uploader.errorMessage.value).toBe("menu.upload.failed");
  });
});
