<template>
  <div class="bg-ios-bg min-h-screen flex items-center justify-center">
    <div class="text-center">
      <ShieldX class="w-12 h-12 text-ios-tertiary mx-auto" />
      <h1 class="text-[22px] font-bold text-ios-text mt-4">無權限存取</h1>
      <p class="text-sm text-ios-secondary mt-2">此頁面僅限廚師角色使用</p>
      <button
        class="bg-ios-blue text-white rounded-full px-6 py-3 font-bold mt-6 min-h-[44px]"
        @click="handleLogin"
      >
        重新登入
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShieldX } from "lucide-vue-next";
import { useRouter } from "vue-router";

const router = useRouter();

const handleLogin = () => {
  router.push("/login");
};
</script>
