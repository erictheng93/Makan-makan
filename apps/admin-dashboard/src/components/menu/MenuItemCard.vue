<template>
  <div
    :class="[
      'bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all duration-[280ms] cursor-pointer group',
      highlighted &&
        'ring-2 ring-[#007AFF] shadow-[0_0_20px_rgba(0,122,255,0.15)]',
    ]"
  >
    <!-- Image -->
    <div class="relative">
      <OptimizedImage
        :src="item.imageUrl || placeholderSvg"
        :alt="item.name"
        :width="600"
        :height="400"
        format="auto"
        fit="cover"
        :lazy="true"
        :fade-in="true"
        image-class="w-full h-44 object-cover rounded-t-2xl"
      />
      <!-- Badges -->
      <div
        class="absolute top-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none"
      >
        <span
          v-if="item.isFeatured"
          class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-ios-warning/90 text-white backdrop-blur-sm"
        >
          {{ t("menu.featured") }}
        </span>
        <span v-else />
        <span
          :class="[
            'px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-sm',
            item.isAvailable
              ? 'bg-ios-success/90 text-white'
              : 'bg-ios-error/85 text-white',
          ]"
        >
          {{ item.isAvailable ? t("menu.available") : t("menu.soldOut") }}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="p-3.5 pb-4">
      <div class="flex justify-between items-start mb-1.5">
        <h3 class="text-[15px] font-bold text-[#1C1C1E] line-clamp-1">
          {{ item.name }}
        </h3>
        <span
          class="text-[15px] font-bold text-ios-primary whitespace-nowrap ml-2"
        >
          {{ formatPrice(item.price) }}
        </span>
      </div>

      <p class="text-xs text-[#8E8E93] leading-relaxed line-clamp-2 mb-2.5">
        {{ item.description }}
      </p>

      <!-- Order metrics -->
      <div
        v-if="item.orderCount && item.orderCount > 0"
        class="flex items-center gap-3 mb-2.5"
      >
        <span class="flex items-center gap-1 text-[11px] text-[#8E8E93]">
          <ShoppingBagIcon class="h-3 w-3" />
          {{ item.orderCount }} {{ t("menu.metrics.sold") }}
        </span>
        <span
          v-if="item.rating && item.rating > 0"
          class="flex items-center gap-1 text-[11px] text-[#FF9500]"
        >
          <StarIcon class="h-3 w-3 fill-current" />
          {{ item.rating.toFixed(1) }}
        </span>
      </div>

      <div class="flex justify-between items-center">
        <div class="flex gap-1">
          <span
            v-if="categoryName"
            class="px-2 py-0.5 bg-[#F2F2F7] rounded-full text-[11px] text-[#8E8E93] font-medium"
          >
            {{ categoryName }}
          </span>
        </div>
        <!-- Hover actions -->
        <div
          class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-black/5 hover:text-[#1C1C1E] transition-colors"
            :title="t('common.edit')"
            @click.stop="$emit('edit', item)"
          >
            <PencilIcon class="h-[15px] w-[15px]" />
          </button>
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-black/5 hover:text-[#1C1C1E] transition-colors"
            :title="
              item.isAvailable
                ? t('menu.statusInactive')
                : t('menu.statusActive')
            "
            @click.stop="$emit('toggle-status', item)"
          >
            <component
              :is="item.isAvailable ? EyeSlashIcon : EyeIcon"
              class="h-[15px] w-[15px]"
            />
          </button>
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#FFEBEE] hover:text-ios-error transition-colors"
            :title="t('common.delete')"
            @click.stop="$emit('delete', item)"
          >
            <TrashIcon class="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import { useCurrency } from "@/composables/useCurrency";
import OptimizedImage from "@/components/OptimizedImage.vue";
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ShoppingBagIcon,
  StarIcon,
} from "@heroicons/vue/24/outline";
import type { MenuItemData } from "@/composables/useMenuManagement";

const { t } = useI18n();
const { formatPrice } = useCurrency();

defineProps<{
  item: MenuItemData;
  categoryName?: string;
  highlighted?: boolean;
}>();

defineEmits<{
  edit: [item: MenuItemData];
  "toggle-status": [item: MenuItemData];
  delete: [item: MenuItemData];
}>();

const placeholderSvg =
  "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27600%27 height=%27400%27 fill=%27%23e5e7eb%27%3E%3Crect width=%27600%27 height=%27400%27/%3E%3Ctext x=%27300%27 y=%27200%27 text-anchor=%27middle%27 dominant-baseline=%27central%27 font-family=%27system-ui%27 font-size=%2748%27 fill=%27%239ca3af%27%3E🍽️%3C/text%3E%3C/svg%3E";
</script>
