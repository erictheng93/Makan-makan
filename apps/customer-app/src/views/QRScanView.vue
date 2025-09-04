<template>
  <div class="min-h-screen bg-black">
    <!-- 頂部導航 -->
    <div class="relative z-10 bg-black bg-opacity-50 backdrop-blur-sm">
      <div class="max-w-md mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <button
            class="w-10 h-10 bg-black bg-opacity-30 rounded-full flex items-center justify-center text-white hover:bg-opacity-50 transition-colors"
            @click="router.back()"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 class="text-white font-semibold text-lg">掃描QR碼</h1>
          <button
            v-if="flashSupported"
            class="w-10 h-10 bg-black bg-opacity-30 rounded-full flex items-center justify-center text-white hover:bg-opacity-50 transition-colors"
            @click="toggleFlash"
          >
            <svg
              v-if="flashOn"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <svg
              v-else
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 掃描區域 -->
    <div class="relative">
      <!-- 相機預覽 -->
      <video
        ref="videoElement"
        class="w-full h-screen object-cover"
        autoplay
        muted
        playsinline
      />

      <!-- 掃描框覆蓋層 -->
      <div class="absolute inset-0 flex items-center justify-center">
        <!-- 遮罩層 -->
        <div class="absolute inset-0 bg-black bg-opacity-50">
          <!-- 透明掃描區域 -->
          <div
            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          >
            <div
              class="w-64 h-64 border-2 border-white border-opacity-50 relative"
            >
              <!-- 四個角落的掃描框 -->
              <div
                class="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white"
              />
              <div
                class="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white"
              />
              <div
                class="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white"
              />
              <div
                class="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white"
              />

              <!-- 掃描線條動畫 -->
              <div
                class="absolute left-0 w-full h-0.5 bg-white opacity-75 animate-pulse"
                :class="scanLineAnimation"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部說明文字 -->
      <div
        class="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-50 backdrop-blur-sm"
      >
        <div class="max-w-md mx-auto px-4 py-8 text-center">
          <p class="text-white text-lg font-medium mb-2">
            {{ scanStatus }}
          </p>
          <p class="text-white text-opacity-75 text-sm">請將QR碼對準掃描框內</p>

          <!-- 手動輸入選項 -->
          <button
            class="mt-6 text-white text-opacity-75 underline hover:text-opacity-100 transition-opacity"
            @click="showManualInput = true"
          >
            無法掃描？點此手動輸入
          </button>
        </div>
      </div>
    </div>

    <!-- 錯誤提示 -->
    <div
      v-if="error"
      class="fixed top-20 left-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-lg max-w-md mx-auto z-20"
    >
      <div class="flex items-start space-x-3">
        <svg
          class="w-6 h-6 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1">
          <p class="font-medium">掃描失敗</p>
          <p class="text-sm text-red-100 mt-1">
            {{ error }}
          </p>
        </div>
        <button
          class="w-6 h-6 flex items-center justify-center text-red-200 hover:text-white"
          @click="clearError"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 載入指示器 -->
    <div
      v-if="isLoading"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30"
    >
      <div class="text-center text-white">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
        />
        <p>正在處理...</p>
      </div>
    </div>

    <!-- 手動輸入對話框 -->
    <ManualInputModal
      v-model:show="showManualInput"
      @restaurant-selected="handleRestaurantSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { BrowserQRCodeReader } from "@zxing/library";
import ManualInputModal from "@/components/ManualInputModal.vue";

const router = useRouter();
const toast = useToast();

const videoElement = ref<HTMLVideoElement>();
const qrReader = ref<BrowserQRCodeReader>();
const stream = ref<MediaStream>();
const isLoading = ref(false);
const error = ref<string>("");
const scanStatus = ref("正在啟動相機...");
const flashSupported = ref(false);
const flashOn = ref(false);
const showManualInput = ref(false);
const scanLineAnimation = ref("animate-bounce");

onMounted(async () => {
  await initializeCamera();
  startScanning();
});

onUnmounted(() => {
  cleanup();
});

const initializeCamera = async () => {
  try {
    isLoading.value = true;
    scanStatus.value = "正在啟動相機...";

    // 檢查相機權限
    const constraints = {
      video: {
        facingMode: "environment", // 後置相機
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    stream.value = await navigator.mediaDevices.getUserMedia(constraints);

    if (videoElement.value) {
      videoElement.value.srcObject = stream.value;
      await videoElement.value.play();
    }

    // 檢查是否支援閃光燈
    const track = stream.value.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    flashSupported.value = "torch" in capabilities;

    scanStatus.value = "請對準QR碼";
  } catch (err) {
    console.error("相機初始化失敗:", err);
    handleCameraError(err);
  } finally {
    isLoading.value = false;
  }
};

const startScanning = () => {
  if (!videoElement.value) return;

  qrReader.value = new BrowserQRCodeReader();

  qrReader.value
    .decodeFromVideoDevice(
      null, // 使用預設相機
      videoElement.value,
      (result, error) => {
        if (result) {
          handleQRCodeDetected(result.getText());
        }

        if (error && !(error.name === "NotFoundException")) {
          console.error("QR掃描錯誤:", error);
        }
      },
    )
    .catch((err) => {
      console.error("開始掃描失敗:", err);
      setError("掃描功能啟動失敗");
    });
};

const handleQRCodeDetected = async (qrContent: string) => {
  try {
    isLoading.value = true;
    scanStatus.value = "處理QR碼中...";

    // 解析QR碼內容
    const qrData = parseQRCode(qrContent);

    if (!qrData) {
      throw new Error("無效的QR碼格式");
    }

    // 添加到最近使用記錄
    await addToRecentRestaurants(qrData);

    // 導航到菜單頁面
    toast.success("掃描成功！");
    router.push(`/restaurant/${qrData.restaurantId}/table/${qrData.tableId}`);
  } catch (err) {
    console.error("QR碼處理失敗:", err);
    setError(err instanceof Error ? err.message : "處理QR碼時發生錯誤");
    scanStatus.value = "請重新對準QR碼";
  } finally {
    isLoading.value = false;
  }
};

const parseQRCode = (content: string) => {
  try {
    // 支援多種QR碼格式

    // 格式1: JSON
    if (content.startsWith("{")) {
      const data = JSON.parse(content);
      return {
        restaurantId: parseInt(data.restaurantId || data.restaurant_id),
        tableId: parseInt(data.tableId || data.table_id),
      };
    }

    // 格式2: URL格式
    if (content.startsWith("http")) {
      const url = new URL(content);
      const pathParts = url.pathname.split("/");
      const restaurantId = pathParts[2];
      const tableId = pathParts[4];

      if (restaurantId && tableId) {
        return {
          restaurantId: parseInt(restaurantId),
          tableId: parseInt(tableId),
        };
      }
    }

    // 格式3: 簡單格式 "restaurantId:tableId"
    if (content.includes(":")) {
      const [restaurantId, tableId] = content.split(":");
      return {
        restaurantId: parseInt(restaurantId),
        tableId: parseInt(tableId),
      };
    }

    return null;
  } catch (error) {
    console.error("QR碼解析失敗:", error);
    return null;
  }
};

const addToRecentRestaurants = async (qrData: {
  restaurantId: number;
  tableId: number;
}) => {
  try {
    // 這裡應該從API獲取餐廳資訊，暫時使用模擬數據
    const restaurantInfo = {
      id: qrData.restaurantId,
      name: `餐廳 ${qrData.restaurantId}`,
      address: "地址資訊",
      lastVisit: Date.now(),
    };

    const saved = localStorage.getItem("makanmakan_recent_restaurants");
    let recent = saved ? JSON.parse(saved) : [];

    // 移除重複項目
    recent = recent.filter((item: any) => item.id !== qrData.restaurantId);

    // 添加到開頭
    recent.unshift(restaurantInfo);

    // 只保留最近10家
    recent = recent.slice(0, 10);

    localStorage.setItem(
      "makanmakan_recent_restaurants",
      JSON.stringify(recent),
    );
  } catch (error) {
    console.warn("儲存最近使用餐廳失敗:", error);
  }
};

const toggleFlash = async () => {
  if (!stream.value || !flashSupported.value) return;

  try {
    const track = stream.value.getVideoTracks()[0];
    await track.applyConstraints({
      advanced: [{ torch: !flashOn.value } as any],
    } as any);
    flashOn.value = !flashOn.value;
  } catch (error) {
    console.error("切換閃光燈失敗:", error);
    toast.error("無法切換閃光燈");
  }
};

const handleCameraError = (err: any) => {
  let message = "相機存取失敗";

  if (err.name === "NotAllowedError") {
    message = "請允許相機權限以使用掃描功能";
  } else if (err.name === "NotFoundError") {
    message = "找不到可用的相機";
  } else if (err.name === "NotSupportedError") {
    message = "您的瀏覽器不支援相機功能";
  }

  setError(message);
};

const setError = (message: string) => {
  error.value = message;
  setTimeout(() => {
    if (error.value === message) {
      clearError();
    }
  }, 5000);
};

const clearError = () => {
  error.value = "";
};

const handleRestaurantSelected = ({
  restaurantId,
  tableId,
}: {
  restaurantId: number;
  tableId: number;
}) => {
  router.push(`/restaurant/${restaurantId}/table/${tableId}`);
};

const cleanup = () => {
  if (qrReader.value) {
    qrReader.value.reset();
  }

  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop());
  }
};
</script>

<style scoped>
.animate-scan-line {
  animation: scanLine 2s ease-in-out infinite;
}

@keyframes scanLine {
  0%,
  100% {
    top: 0;
  }
  50% {
    top: calc(100% - 2px);
  }
}
</style>
