<template>
  <div class="skeleton-loader" :class="{ animated: animated }">
    <!-- Text Skeleton -->
    <div
      v-if="type === 'text'"
      class="skeleton skeleton-text"
      :style="textStyle"
    ></div>

    <!-- Circle Skeleton -->
    <div
      v-else-if="type === 'circle'"
      class="skeleton skeleton-circle"
      :style="circleStyle"
    ></div>

    <!-- Rectangle Skeleton -->
    <div
      v-else-if="type === 'rect'"
      class="skeleton skeleton-rect"
      :style="rectStyle"
    ></div>

    <!-- Avatar Skeleton -->
    <div v-else-if="type === 'avatar'" class="skeleton-avatar">
      <div
        class="skeleton skeleton-circle"
        :style="{ width: size + 'px', height: size + 'px' }"
      ></div>
    </div>

    <!-- Card Skeleton -->
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div class="skeleton skeleton-rect card-image"></div>
      <div class="card-content">
        <div
          class="skeleton skeleton-text"
          style="width: 80%; height: 20px"
        ></div>
        <div
          class="skeleton skeleton-text"
          style="width: 60%; height: 16px; margin-top: 8px"
        ></div>
        <div
          class="skeleton skeleton-text"
          style="width: 90%; height: 14px; margin-top: 12px"
        ></div>
      </div>
    </div>

    <!-- Table Row Skeleton -->
    <div v-else-if="type === 'table-row'" class="skeleton-table-row">
      <div
        v-for="(col, index) in columns"
        :key="index"
        class="skeleton skeleton-text"
        :style="{ width: col.width || '100px', height: '16px' }"
      ></div>
    </div>

    <!-- List Item Skeleton -->
    <div v-else-if="type === 'list-item'" class="skeleton-list-item">
      <div
        class="skeleton skeleton-circle"
        style="width: 40px; height: 40px"
      ></div>
      <div class="item-content">
        <div
          class="skeleton skeleton-text"
          style="width: 70%; height: 16px"
        ></div>
        <div
          class="skeleton skeleton-text"
          style="width: 50%; height: 14px; margin-top: 6px"
        ></div>
      </div>
    </div>

    <!-- Custom Skeleton -->
    <slot v-else></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  type?:
    | "text"
    | "circle"
    | "rect"
    | "avatar"
    | "card"
    | "table-row"
    | "list-item"
    | "custom";
  width?: string | number;
  height?: string | number;
  size?: number;
  animated?: boolean;
  columns?: Array<{ width?: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  width: "100%",
  height: 16,
  size: 40,
  animated: true,
  columns: () => [],
});

const textStyle = computed(() => ({
  width: typeof props.width === "number" ? `${props.width}px` : props.width,
  height: typeof props.height === "number" ? `${props.height}px` : props.height,
}));

const circleStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

const rectStyle = computed(() => ({
  width: typeof props.width === "number" ? `${props.width}px` : props.width,
  height: typeof props.height === "number" ? `${props.height}px` : props.height,
}));
</script>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  border-radius: 4px;
}

.skeleton-loader.animated .skeleton {
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Text Skeleton */
.skeleton-text {
  height: 16px;
  margin: 4px 0;
}

/* Circle Skeleton */
.skeleton-circle {
  border-radius: 50%;
}

/* Rectangle Skeleton */
.skeleton-rect {
  border-radius: 8px;
}

/* Avatar Skeleton */
.skeleton-avatar {
  display: inline-block;
}

/* Card Skeleton */
.skeleton-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-image {
  width: 100%;
  height: 200px;
  margin-bottom: 16px;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Table Row Skeleton */
.skeleton-table-row {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
}

/* List Item Skeleton */
.skeleton-list-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
