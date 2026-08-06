<template>
  <div class="multi-metric-chart">
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

interface MetricDataPoint {
  timestamp: number;
  value: number;
}

interface MetricSeries {
  label: string;
  data: MetricDataPoint[];
  color: string;
  fillColor?: string;
}

interface Props {
  series: MetricSeries[];
  unit?: string;
  showGrid?: boolean;
  height?: number;
  yAxisLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  unit: "",
  showGrid: true,
  height: 300,
  yAxisLabel: "",
});

const { formatTime } = useDateFormatter();

const chartData = computed((): ChartData<"line"> => {
  // Use timestamps from the first series as labels
  const labels =
    props.series[0]?.data.map((point) =>
      formatTime(new Date(point.timestamp)),
    ) || [];

  const datasets = props.series.map((metric) => ({
    label: metric.label,
    data: metric.data.map((point) => point.value),
    borderColor: metric.color,
    backgroundColor: metric.fillColor || `${metric.color}20`,
    borderWidth: 2,
    fill: false,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: metric.color,
    pointBorderColor: "#fff",
    pointBorderWidth: 2,
  }));

  return {
    labels,
    datasets,
  };
});

const chartOptions = computed(
  (): ChartOptions<"line"> => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#6b7280",
          font: {
            size: 12,
            weight: 500,
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: "circle",
        },
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
        displayColors: true,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y ?? 0;
            return `${context.dataset.label}: ${value.toFixed(2)}${props.unit}`;
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
        title: {
          display: !!props.yAxisLabel,
          text: props.yAxisLabel,
          color: "#6b7280",
          font: {
            size: 12,
            weight: 600,
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
.multi-metric-chart {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
