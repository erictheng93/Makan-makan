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
        <p>暫無營收數據</p>
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
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { BarChart3 } from "lucide-vue-next";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface RevenueDataPoint {
  label: string;
  value: number;
  date: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading?: boolean;
  period: "daily" | "weekly" | "monthly";
}

const props = withDefaults(defineProps<RevenueChartProps>(), {
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
  const values = props.data.map((item) => item.value);

  const maxValue = Math.max(...values);
  const suggestedMax = maxValue * 1.1;

  chartInstance = new ChartJS(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "營收",
          data: values,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "rgb(59, 130, 246)",
          pointBorderColor: "white",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: "rgb(37, 99, 235)",
          pointHoverBorderColor: "white",
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
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "金額 (TWD)",
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
            callback: function (value) {
              return "$" + (value as number).toLocaleString();
            },
          },
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
            label: function (context) {
              const value = context.parsed.y;
              const dataPoint = props.data[context.dataIndex];
              return [
                `營收: $${value.toLocaleString()}`,
                `日期: ${dataPoint.date}`,
              ];
            },
          },
        },
        legend: {
          display: false,
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
