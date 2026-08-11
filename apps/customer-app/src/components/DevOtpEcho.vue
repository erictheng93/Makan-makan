<template>
  <p class="mt-2 text-xs text-gray-500">Dev OTP: {{ otp }}</p>
</template>

<script setup lang="ts">
defineProps<{
  otp: string;
}>();
</script>
