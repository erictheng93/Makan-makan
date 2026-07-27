import { ref } from "vue";
import { useI18n } from "@/i18n";
import { getAuthToken } from "@/utils/authTokenProvider";

export type ImageUploadState = "idle" | "uploading" | "success" | "error";
export type ImageVariantKey = "thumbnail" | "small" | "medium" | "large";
export type ImageVariants = Partial<Record<ImageVariantKey, string>>;

export interface ImageUploadResult {
  imageId: string;
  imageUrl: string;
  imageVariants: ImageVariants;
}

type UploadResponse = {
  success?: boolean;
  data?: {
    id?: string;
    variants?: Record<string, string | undefined>;
  };
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VARIANT_KEYS: ImageVariantKey[] = [
  "thumbnail",
  "small",
  "medium",
  "large",
];

const CLIENT_VARIANT_SPECS: Array<{
  key: ImageVariantKey;
  maxSize: number;
}> = [
  { key: "thumbnail", maxSize: 150 },
  { key: "small", maxSize: 300 },
  { key: "medium", maxSize: 600 },
  { key: "large", maxSize: 1200 },
];

function pickSupportedVariants(
  variants: Record<string, string | undefined> = {},
): ImageVariants {
  return VARIANT_KEYS.reduce<ImageVariants>((picked, key) => {
    const value = variants[key];
    if (value) {
      picked[key] = value;
    }
    return picked;
  }, {});
}

async function downsampleImage(
  file: File,
  maxSize: number,
  variant: string,
): Promise<File> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close?.();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.85);
  });

  if (!blob) {
    return file;
  }

  return new File(
    [blob],
    `${variant}-${file.name.replace(/\.[^/.]+$/, "")}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now(),
    },
  );
}

async function buildUploadFormData(file: File): Promise<FormData> {
  const formData = new FormData();
  formData.append("file", file);

  const variants = await Promise.all(
    CLIENT_VARIANT_SPECS.map(async ({ key, maxSize }) => ({
      key,
      file: await downsampleImage(file, maxSize, key),
    })),
  );

  for (const variant of variants) {
    formData.append(variant.key, variant.file);
  }

  return formData;
}

export function useImageUpload() {
  const { t } = useI18n();
  const state = ref<ImageUploadState>("idle");
  const errorMessage = ref("");
  const result = ref<ImageUploadResult | null>(null);

  const setError = (messageKey: string) => {
    state.value = "error";
    errorMessage.value = t(messageKey);
    result.value = null;
  };

  const upload = async (
    file: File,
    options: { restaurantId?: string | null } = {},
  ): Promise<ImageUploadResult | null> => {
    errorMessage.value = "";
    result.value = null;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError("menu.upload.invalidType");
      return null;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("menu.upload.fileTooLarge");
      return null;
    }

    state.value = "uploading";

    try {
      const formData = await buildUploadFormData(file);

      // Platform admins (role 0) carry restaurantId: null in their token, so
      // apps/image-processor resolves the owning restaurant from this query
      // param instead. Without it every admin upload is rejected with 403
      // "Restaurant access is required for image uploads". Shop owners ignore
      // the param — the worker always trusts their token for role !== 0.
      const query = new URLSearchParams({ category: "menu" });
      if (options.restaurantId) {
        query.set("restaurantId", options.restaurantId);
      }

      const response = await fetch(
        `${import.meta.env.VITE_IMAGE_API_URL}/images/upload?${query.toString()}`,
        {
          method: "POST",
          // getAuthToken reads the auth-client storage directly — the Pinia
          // token ref can lag behind interceptor/proactive refreshes.
          headers: {
            Authorization: `Bearer ${getAuthToken() ?? ""}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Image upload failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as UploadResponse;
      const variants = pickSupportedVariants(body.data?.variants);
      const imageId = body.data?.id;
      const imageUrl = variants.medium;

      if (!body.success || !imageId || !imageUrl) {
        throw new Error("Image upload response missing required data");
      }

      result.value = {
        imageId,
        imageUrl,
        imageVariants: variants,
      };
      state.value = "success";
      return result.value;
    } catch {
      setError("menu.upload.failed");
      return null;
    }
  };

  const reset = () => {
    state.value = "idle";
    errorMessage.value = "";
    result.value = null;
  };

  return {
    upload,
    reset,
    state,
    errorMessage,
    result,
  };
}
