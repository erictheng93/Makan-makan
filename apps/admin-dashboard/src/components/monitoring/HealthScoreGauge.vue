<template>
  <div class="health-score-gauge">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend)

interface Props {
  score: number
  label?: string
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  label: '健康分數',
  size: 200,
})

/**
 * Get color based on health score
 */
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10b981' // green
  if (score >= 60) return '#f59e0b' // yellow
  if (score >= 40) return '#f97316' // orange
  return '#ef4444' // red
}

const chartData = computed((): ChartData<'doughnut'> => {
  const score = Math.max(0, Math.min(100, props.score))
  const remaining = 100 - score
  const color = getScoreColor(score)

  return {
    labels: [props.label, ''],
    datasets: [
      {
        data: [score, remaining],
        backgroundColor: [color, 'rgba(229, 231, 235, 0.3)'],
        borderColor: [color, 'rgba(229, 231, 235, 0.5)'],
        borderWidth: 2,
        circumference: 180,
        rotation: 270,
      },
    ],
  }
})

const chartOptions = computed((): ChartOptions<'doughnut'> => ({
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 2,
  cutout: '75%',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: getScoreColor(props.score),
      borderWidth: 1,
      displayColors: false,
      callbacks: {
        label: (context) => {
          if (context.dataIndex === 0) {
            return `${props.label}: ${context.parsed}/100`
          }
          return ''
        },
      },
    },
  },
}))
</script>

<style scoped>
.health-score-gauge {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}
</style>
