<template>
  <div class="qr-code-renderer inline-flex flex-col items-center">
    <div
      class="bg-white rounded-2xl overflow-hidden"
      :class="containerClass"
      :style="{
        width: `${size + padding * 2}px`,
        height: `${size + padding * 2}px`,
      }"
    >
      <img
        v-if="dataUrl"
        :src="dataUrl"
        :alt="label || 'QR Code'"
        :width="size + padding * 2"
        :height="size + padding * 2"
        class="block"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center bg-gray-50"
      >
        <div class="animate-pulse w-3/4 h-3/4 bg-gray-200 rounded-lg" />
      </div>
    </div>
    <p v-if="label" class="mt-1.5 text-xs text-gray-500 font-medium">
      {{ label }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import QRCode from "qrcode";

const props = withDefaults(
  defineProps<{
    /** The string content to encode as a QR code */
    content: string;
    /** QR image size in pixels (default 200) */
    size?: number;
    /** Internal padding in pixels (default 8) */
    padding?: number;
    /** Optional label displayed below the QR code */
    label?: string;
    /** Additional CSS classes for the container */
    containerClass?: string;
  }>(),
  {
    size: 200,
    padding: 8,
    label: undefined,
    containerClass: "",
  },
);

const dataUrl = ref<string>("");

watchEffect(async () => {
  if (!props.content) {
    dataUrl.value = "";
    return;
  }
  try {
    dataUrl.value = await QRCode.toDataURL(props.content, {
      width: props.size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#1C1C1E",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("QR code generation failed:", err);
    dataUrl.value = "";
  }
});

/** Expose the data URL for download/print use by parent components */
function getDataUrl(): string {
  return dataUrl.value;
}

defineExpose({ getDataUrl });
</script>
