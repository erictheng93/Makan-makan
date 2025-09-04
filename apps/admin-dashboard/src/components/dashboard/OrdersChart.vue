<template>
  <div class="h-80">
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="animate-pulse flex space-x-4 w-full">
        <div class="rounded-full bg-gray-300 h-10 w-10" />
        <div class="flex-1 space-y-2 py-1">
          <div class="h-4 bg-gray-300 rounded w-3/4" />
          <div class="space-y-2">
            <div class="h-4 bg-gray-300 rounded" />
            <div class="h-4 bg-gray-300 rounded w-5/6" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="!data || data.length === 0"
      class="flex items-center justify-center h-full text-gray-500"
    >
      <div class="text-center">
        <BarChart3 class="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>暫無訂單數據</p>
      </div>
    </div>

    <canvas v-else ref="chartCanvas" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { BarChart3 } from "lucide-vue-next";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface OrderDataPoint {
  label: string;
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  date: string;
}

interface OrdersChartProps {
  data: OrderDataPoint[];
  loading?: boolean;
  period: "daily" | "weekly" | "monthly";
}

const props = withDefaults(defineProps<OrdersChartProps>(), {
  loading: false,
});

const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: ChartJS | null = null;

const createChart = async () => {
  if (!chartCanvas.value || !props.data || props.data.length === 0) return;

  await nextTick();

  const ctx = chartCanvas.value.getContext("2d");
  if (!ctx) return;

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = props.data.map((item) => item.label);
  const completedData = props.data.map((item) => item.completed);
  const pendingData = props.data.map((item) => item.pending);
  const cancelledData = props.data.map((item) => item.cancelled);

  const maxValue = Math.max(...props.data.map((item) => item.total));
  const suggestedMax = Math.ceil(maxValue * 1.1);

  chartInstance = new ChartJS(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "已完成",
          data: completedData,
          backgroundColor: "rgba(34, 197, 94, 0.8)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: "處理中",
          data: pendingData,
          backgroundColor: "rgba(251, 191, 36, 0.8)",
          borderColor: "rgb(251, 191, 36)",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: "已取消",
          data: cancelledData,
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: getPeriodLabel(),
            font: {
              size: 12,
              weight: "bold",
            },
          },
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
          },
          stacked: true,
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "訂單數量",
            font: {
              size: 12,
              weight: "bold",
            },
          },
          beginAtZero: true,
          suggestedMax,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
          ticks: {
            font: {
              size: 11,
            },
            stepSize: 1,
            callback: function (value) {
              return Math.floor(value as number).toString();
            },
          },
          stacked: true,
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "rgba(59, 130, 246, 0.8)",
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            title: function (context) {
              const dataPoint = props.data[context[0].dataIndex];
              return `${context[0].label} - ${dataPoint.date}`;
            },
            afterBody: function (context) {
              const dataIndex = context[0].dataIndex;
              const dataPoint = props.data[dataIndex];
              return `總計: ${dataPoint.total} 筆訂單`;
            },
          },
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            padding: 20,
            font: {
              size: 12,
            },
          },
        },
      },
      animation: {
        duration: 1000,
        easing: "easeOutQuart",
      },
    },
  });
};

const getPeriodLabel = () => {
  switch (props.period) {
    case "daily":
      return "時段";
    case "weekly":
      return "日期";
    case "monthly":
      return "日期";
    default:
      return "時間";
  }
};

watch(
  () => [props.data, props.period],
  () => {
    if (!props.loading) {
      createChart();
    }
  },
  { deep: true },
);

onMounted(() => {
  if (!props.loading && props.data) {
    createChart();
  }
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>
