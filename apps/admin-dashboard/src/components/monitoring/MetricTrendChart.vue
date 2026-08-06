<template>
  <div class="metric-trend-chart">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Line } from "vue-chartjs";
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
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { useDateFormatter } from "@/composables/useDateFormatter";

// Register Chart.js components
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

interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

interface Props {
  data: DataPoint[];
  label: string;
  color?: string;
  fillColor?: string;
  unit?: string;
  showGrid?: boolean;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  color: "#3b82f6",
  fillColor: "rgba(59, 130, 246, 0.1)",
  unit: "",
  showGrid: true,
  height: 300,
});

const { formatTime } = useDateFormatter();

const chartData = computed((): ChartData<"line"> => {
  const labels = props.data.map((point) =>
    formatTime(new Date(point.timestamp)),
  );

  const values = props.data.map((point) => point.value);

  return {
    labels,
    datasets: [
      {
        label: props.label,
        data: values,
        borderColor: props.color,
        backgroundColor: props.fillColor,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: props.color,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  };
});

const chartOptions = computed(
  (): ChartOptions<"line"> => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: props.color,
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? 0;
            return `${props.label}: ${value.toFixed(2)}${props.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: props.showGrid,
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: {
          display: props.showGrid,
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
          callback: (value) => {
            return `${value}${props.unit}`;
          },
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  }),
);
</script>

<style scoped>
.metric-trend-chart {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
