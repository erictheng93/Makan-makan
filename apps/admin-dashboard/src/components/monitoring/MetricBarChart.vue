<template>
  <div class="metric-bar-chart">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: DataPoint[];
  title?: string;
  unit?: string;
  showGrid?: boolean;
  height?: number;
  horizontal?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  unit: "",
  showGrid: true,
  height: 300,
  horizontal: false,
});

const chartData = computed((): ChartData<"bar"> => {
  const labels = props.data.map((point) => point.label);
  const values = props.data.map((point) => point.value);
  const colors = props.data.map((point) => point.color || "#007aff");

  return {
    labels,
    datasets: [
      {
        label: props.title,
        data: values,
        backgroundColor: colors.map((color) => `${color}cc`),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
});

const chartOptions = computed(
  (): ChartOptions<"bar"> => ({
    indexAxis: props.horizontal ? "y" : "x",
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
        borderColor: "#374151",
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          label: (context) => {
            const value = context.parsed[props.horizontal ? "x" : "y"] ?? 0;
            return `${context.label}: ${value.toFixed(0)}${props.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: props.showGrid && !props.horizontal,
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
          display: props.showGrid && props.horizontal,
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          font: {
            size: 11,
          },
          callback: (value) => {
            return props.horizontal ? value : `${value}${props.unit}`;
          },
        },
      },
    },
  }),
);
</script>

<style scoped>
.metric-bar-chart {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
