<template>
  <div class="base-chart-container" :style="containerStyle">
    <canvas ref="canvasRef"></canvas>
    <div v-if="isLoading" class="chart-loading">
      <div class="spinner"></div>
      <p>{{ t("common.loading") }}</p>
    </div>
    <div v-if="error" class="chart-error">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  computed,
  type CSSProperties,
} from "vue";
import { useI18n } from "@/i18n";

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface Props {
  type: "bar" | "line" | "pie" | "doughnut";
  data: ChartData;
  options?: Record<string, unknown>;
  height?: number;
  isLoading?: boolean;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  isLoading: false,
  error: "",
});

const { t } = useI18n();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const containerStyle = computed<CSSProperties>(() => ({
  height: `${props.height}px`,
  position: "relative",
}));

const renderChart = () => {
  if (!canvasRef.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const container = canvas.parentElement;
  if (container) {
    canvas.width = container.clientWidth;
    canvas.height = props.height;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (props.isLoading || props.error) return;

  switch (props.type) {
    case "bar":
      renderBarChart(ctx, canvas);
      break;
    case "line":
      renderLineChart(ctx, canvas);
      break;
    case "pie":
    case "doughnut":
      renderPieChart(ctx, canvas);
      break;
  }
};

const renderBarChart = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => {
  const padding = 60;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;

  const datasets = props.data.datasets;
  const labels = props.data.labels;
  const dataCount = labels.length;

  let maxValue = 0;
  datasets.forEach((dataset) => {
    const max = Math.max(...dataset.data);
    if (max > maxValue) maxValue = max;
  });

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#6b7280";

  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = padding + (chartHeight * i) / steps;
    const value = maxValue * (1 - i / steps);

    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
  }

  const barWidth = (chartWidth / dataCount / datasets.length) * 0.8;
  const groupWidth = chartWidth / dataCount;

  datasets.forEach((dataset, datasetIndex) => {
    dataset.data.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight;
      const x = padding + index * groupWidth + datasetIndex * barWidth;
      const y = padding + chartHeight - barHeight;

      // -nOr
      const bgColor = Array.isArray(dataset.backgroundColor)
        ? dataset.backgroundColor[index] || dataset.backgroundColor[0]
        : dataset.backgroundColor || "#007aff";

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = "#374151";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
    });
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";

  labels.forEach((label, index) => {
    const x = padding + index * groupWidth + groupWidth / 2;
    const y = canvas.height - padding + 20;
    ctx.fillText(label, x, y);
  });

  if (datasets.length > 1) {
    renderLegend(ctx, canvas, datasets);
  }
};

const renderLineChart = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => {
  const padding = 60;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;

  const datasets = props.data.datasets;
  const labels = props.data.labels;
  const dataCount = labels.length;

  let maxValue = 0;
  datasets.forEach((dataset) => {
    const max = Math.max(...dataset.data);
    if (max > maxValue) maxValue = max;
  });

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#6b7280";

  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = padding + (chartHeight * i) / steps;
    const value = maxValue * (1 - i / steps);

    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
  }

  datasets.forEach((dataset, _datasetIndex) => {
    const lineColor = Array.isArray(dataset.borderColor)
      ? dataset.borderColor[0]
      : dataset.borderColor || "#007aff";

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataset.data.forEach((value, index) => {
      const x = padding + (index * chartWidth) / (dataCount - 1);
      const y = padding + chartHeight - (value / maxValue) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    dataset.data.forEach((value, index) => {
      const x = padding + (index * chartWidth) / (dataCount - 1);
      const y = padding + chartHeight - (value / maxValue) * chartHeight;

      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#374151";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(value.toString(), x, y - 10);
    });
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";

  labels.forEach((label, index) => {
    const x = padding + (index * chartWidth) / (dataCount - 1);
    const y = canvas.height - padding + 20;
    ctx.fillText(label, x, y);
  });

  if (datasets.length > 1) {
    renderLegend(ctx, canvas, datasets);
  }
};

const renderPieChart = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 - 20;
  const radius = Math.min(canvas.width, canvas.height) / 3;

  const dataset = props.data.datasets[0];
  const labels = props.data.labels;
  const total = dataset.data.reduce((sum, val) => sum + val, 0);

  let startAngle = -Math.PI / 2;

  dataset.data.forEach((value, index) => {
    const angle = (value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;

    const bgColor = Array.isArray(dataset.backgroundColor)
      ? dataset.backgroundColor[index]
      : dataset.backgroundColor ||
        `hsl(${(index * 360) / dataset.data.length}, 70%, 60%)`;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const midAngle = startAngle + angle / 2;
    const textX = centerX + Math.cos(midAngle) * (radius * 0.7);
    const textY = centerY + Math.sin(midAngle) * (radius * 0.7);

    const percentage = ((value / total) * 100).toFixed(1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${percentage}%`, textX, textY);

    startAngle = endAngle;
  });

  if (props.type === "doughnut") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  renderPieLegend(ctx, canvas, labels, dataset);
};

const renderLegend = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  datasets: ChartDataset[],
) => {
  const legendY = 20;
  const legendX = canvas.width - 150;

  datasets.forEach((dataset, index) => {
    const color = Array.isArray(dataset.backgroundColor)
      ? dataset.backgroundColor[0]
      : dataset.backgroundColor || "#007aff";

    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY + index * 25, 15, 15);

    ctx.fillStyle = "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(dataset.label, legendX + 20, legendY + index * 25 + 11);
  });
};

const renderPieLegend = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  labels: string[],
  dataset: ChartDataset,
) => {
  const legendX = 20;
  const legendStartY = canvas.height - 80;

  labels.forEach((label, index) => {
    const bgColor = Array.isArray(dataset.backgroundColor)
      ? dataset.backgroundColor[index]
      : dataset.backgroundColor ||
        `hsl(${(index * 360) / labels.length}, 70%, 60%)`;

    ctx.fillStyle = bgColor;
    ctx.fillRect(legendX, legendStartY + index * 20, 15, 15);

    ctx.fillStyle = "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, legendX + 20, legendStartY + index * 20 + 11);
  });
};

watch(
  () => props.data,
  () => {
    renderChart();
  },
  { deep: true },
);

watch(
  () => props.type,
  () => {
    renderChart();
  },
);

watch(
  () => props.isLoading,
  () => {
    renderChart();
  },
);

const handleResize = () => {
  renderChart();
};

onMounted(() => {
  renderChart();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.base-chart-container {
  width: 100%;
  position: relative;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

canvas {
  width: 100%;
  height: 100%;
}

.chart-loading,
.chart-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 10px;
  border: 4px solid #e5e7eb;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chart-loading p,
.chart-error p {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.error-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 10px;
}

.chart-error p {
  color: #ff3b30;
}
</style>
