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

  const upload = async (file: File): Promise<ImageUploadResult | null> => {
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
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_IMAGE_API_URL}/images/upload?category=menu`,
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
