<template>
  <div class="scheduling-calendar">
    <!-- Calendar Header -->
    <div class="calendar-header">
      <button class="nav-btn" @click="previousMonth" :disabled="loading">
        <span class="nav-icon">◀</span>
      </button>
      <div class="header-center">
        <h2 class="current-month">{{ currentMonthYear }}</h2>
        <button class="today-btn" @click="goToToday" v-if="!isCurrentMonth">
          <span>📅</span>
          <span>回到今天</span>
        </button>
      </div>
      <button class="nav-btn" @click="nextMonth" :disabled="loading">
        <span class="nav-icon">▶</span>
      </button>
    </div>

    <!-- Loading State -->
    <transition name="fade">
      <div v-if="loading" class="loading-state">
        <div class="spinner-small"></div>
        <p>載入日曆中...</p>
      </div>
    </transition>

    <!-- Calendar Grid -->
    <transition name="fade" mode="out-in">
      <div v-if="!loading" class="calendar-grid" :key="currentDate.toISOString()">
        <!-- Weekday Headers -->
        <div v-for="day in weekdays" :key="day" class="day-header">
          <span class="day-name">{{ day }}</span>
        </div>

        <!-- Calendar Days -->
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="{
            'other-month': day.isOtherMonth,
            'today': day.isToday,
            'weekend': day.isWeekend,
            'has-schedules': day.scheduleCount > 0,
            'many-schedules': day.scheduleCount > 3
          }"
          @click="selectDate(day.date)"
          @mouseenter="hoveredDate = day.date"
          @mouseleave="hoveredDate = null"
        >
          <div class="day-content">
            <div class="day-number">{{ day.dayNumber }}</div>
            <transition name="scale">
              <div v-if="day.scheduleCount > 0" class="schedule-indicators">
                <div class="schedule-badge" :class="getScheduleBadgeClass(day.scheduleCount)">
                  <span class="badge-icon">📋</span>
                  <span class="badge-count">{{ day.scheduleCount }}</span>
                </div>
                <div v-if="hoveredDate === day.date" class="schedule-preview">
                  {{ day.scheduleCount }} 個排班
                </div>
              </div>
            </transition>
          </div>
          <div v-if="day.isToday" class="today-marker">今天</div>
        </div>
      </div>
    </transition>

    <!-- Calendar Legend -->
    <div class="calendar-legend">
      <div class="legend-item">
        <span class="legend-color today-color"></span>
        <span class="legend-label">今天</span>
      </div>
      <div class="legend-item">
        <span class="legend-color schedule-color"></span>
        <span class="legend-label">有排班</span>
      </div>
      <div class="legend-item">
        <span class="legend-color weekend-color"></span>
        <span class="legend-label">週末</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { EmployeeSchedule } from '@/types/scheduling'

interface Props {
  schedules: EmployeeSchedule[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  dateSelect: [date: string]
  scheduleClick: [schedule: EmployeeSchedule]
}>()

// State
const currentDate = ref(new Date())
const hoveredDate = ref<string | null>(null)

// Computed
const currentMonthYear = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}年 ${month}月`
})

const isCurrentMonth = computed(() => {
  const today = new Date()
  return (
    currentDate.value.getFullYear() === today.getFullYear() &&
    currentDate.value.getMonth() === today.getMonth()
  )
})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()

  const days: any[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Previous month days
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = prevMonthLastDay - i
    const date = new Date(year, month - 1, dayNumber)
    const formattedDate = formatDate(date)
    days.push({
      dayNumber,
      date: formattedDate,
      isOtherMonth: true,
      isToday: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      scheduleCount: getScheduleCount(formattedDate)
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    const formattedDate = formatDate(date)
    days.push({
      dayNumber: i,
      date: formattedDate,
      isOtherMonth: false,
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      scheduleCount: getScheduleCount(formattedDate)
    })
  }

  // Next month days
  const remainingDays = 42 - days.length // 6 weeks * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    const formattedDate = formatDate(date)
    days.push({
      dayNumber: i,
      date: formattedDate,
      isOtherMonth: true,
      isToday: false,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      scheduleCount: getScheduleCount(formattedDate)
    })
  }

  return days
})

// Methods
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

const getScheduleCount = (date: string): number => {
  return props.schedules.filter(s => s.workDate === date).length
}

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
}

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
}

const selectDate = (date: string) => {
  emit('dateSelect', date)
}

const goToToday = () => {
  currentDate.value = new Date()
}

const getScheduleBadgeClass = (count: number) => {
  if (count >= 5) return 'badge-high'
  if (count >= 3) return 'badge-medium'
  return 'badge-low'
}
</script>

<style scoped>
.scheduling-calendar {
  width: 100%;
}

/* Header */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.nav-btn {
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.nav-btn:hover:not(:disabled) {
  background: #f9fafb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.current-month {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.today-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #3b82f6;
  background: white;
  color: #3b82f6;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.today-btn:hover {
  background: #3b82f6;
  color: white;
  transform: translateY(-1px);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #6b7280;
}

.spinner-small {
  width: 35px;
  height: 35px;
  border: 3px solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

/* Calendar Grid */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 12px;
}

.day-header {
  background: white;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.day-name {
  display: inline-block;
}

/* Calendar Day Cells */
.calendar-day {
  background: white;
  padding: 12px;
  min-height: 110px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  border-radius: 10px;
  border: 2px solid transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.calendar-day:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-color: #e5e7eb;
}

.calendar-day.other-month {
  opacity: 0.3;
  background: #fafafa;
}

.calendar-day.weekend {
  background: linear-gradient(135deg, #fff 0%, #fef3c7 100%);
}

.calendar-day.today {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.calendar-day.today .day-number {
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.calendar-day.has-schedules {
  border-left: 4px solid #3b82f6;
}

.calendar-day.many-schedules {
  background: linear-gradient(135deg, #fff 0%, #e0f2fe 100%);
  border-left-width: 6px;
}

.day-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.day-number {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.today-marker {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #3b82f6;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Schedule Indicators */
.schedule-indicators {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
}

.schedule-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #dbeafe;
  color: #1e40af;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.schedule-badge.badge-low {
  background: #dbeafe;
  color: #1e40af;
}

.schedule-badge.badge-medium {
  background: #fef3c7;
  color: #92400e;
}

.schedule-badge.badge-high {
  background: #fecaca;
  color: #991b1b;
}

.badge-icon {
  font-size: 12px;
}

.badge-count {
  font-weight: 700;
}

.schedule-preview {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.schedule-preview::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid #1f2937;
}

/* Calendar Legend */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding: 16px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.legend-color.today-color {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #3b82f6;
}

.legend-color.schedule-color {
  background: #dbeafe;
}

.legend-color.weekend-color {
  background: linear-gradient(135deg, #fff 0%, #fef3c7 100%);
}

.legend-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .calendar-header {
    flex-direction: column;
    gap: 12px;
  }

  .header-center {
    width: 100%;
    flex-direction: column;
  }

  .calendar-grid {
    gap: 4px;
    padding: 4px;
  }

  .calendar-day {
    padding: 8px;
    min-height: 80px;
  }

  .day-number {
    font-size: 13px;
  }

  .schedule-badge {
    font-size: 10px;
    padding: 3px 6px;
  }

  .calendar-legend {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
