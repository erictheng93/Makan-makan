<template>
  <div class="leave-calendar">
    <!-- 月份導航 -->
    <div class="calendar-header">
      <button class="nav-btn" @click="previousMonth">
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
      <h2 class="month-title">{{ currentMonth }}</h2>
      <button class="nav-btn" @click="nextMonth">
        <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- 星期標題 -->
    <div class="weekdays">
      <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
    </div>

    <!-- 日期格子 -->
    <div class="calendar-grid">
      <div
        v-for="day in calendarDays"
        :key="day.date"
        class="calendar-day"
        :class="{
          'other-month': day.isOtherMonth,
          today: day.isToday,
          'has-leave': day.leaveRequests.length > 0,
        }"
      >
        <div class="day-number">{{ day.number }}</div>
        <div v-if="day.leaveRequests.length > 0" class="leave-indicators">
          <div
            v-for="request in day.leaveRequests.slice(0, 3)"
            :key="request.id"
            class="leave-indicator"
            :style="{ backgroundColor: request.leaveType?.color || '#007aff' }"
            :title="`${request.employee?.fullName} - ${request.leaveType?.name}`"
          />
          <span v-if="day.leaveRequests.length > 3" class="more-indicator">
            +{{ day.leaveRequests.length - 3 }}
          </span>
        </div>
      </div>
    </div>

    <!-- 圖例 -->
    <div class="calendar-legend">
      <div v-for="type in activeLeaveTypes" :key="type.id" class="legend-item">
        <div
          class="legend-color"
          :style="{ backgroundColor: type.color || '#007aff' }"
        />
        <span class="legend-label">{{ type.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/i18n";
import { useDateFormatter } from "@/composables/useDateFormatter";
import type { LeaveRequest, LeaveType } from "@makanmasak/shared-types";

const { t } = useI18n();
const { formatMonthYear } = useDateFormatter();

interface CalendarDay {
  date: string;
  number: number;
  isOtherMonth: boolean;
  isToday: boolean;
  leaveRequests: LeaveRequest[];
}

interface Props {
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
}

const props = defineProps<Props>();

const currentDate = ref(new Date());

const weekdays = computed(() => [
  t("weekdays.short.sunday"),
  t("weekdays.short.monday"),
  t("weekdays.short.tuesday"),
  t("weekdays.short.wednesday"),
  t("weekdays.short.thursday"),
  t("weekdays.short.friday"),
  t("weekdays.short.saturday"),
]);

const currentMonth = computed(() => {
  return formatMonthYear(currentDate.value);
});

const calendarDays = computed((): CalendarDay[] => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);

  const days: CalendarDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 上個月的日期
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date: date.toISOString().split("T")[0],
      number: prevLastDay.getDate() - i,
      isOtherMonth: true,
      isToday: false,
      leaveRequests: getLeaveRequestsForDate(date),
    });
  }

  // 本月的日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({
      date: date.toISOString().split("T")[0],
      number: i,
      isOtherMonth: false,
      isToday: date.getTime() === today.getTime(),
      leaveRequests: getLeaveRequestsForDate(date),
    });
  }

  // 下個月的日期（填滿格子）
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date: date.toISOString().split("T")[0],
      number: i,
      isOtherMonth: true,
      isToday: false,
      leaveRequests: getLeaveRequestsForDate(date),
    });
  }

  return days;
});

const activeLeaveTypes = computed(() => {
  const usedTypeIds = new Set(props.leaveRequests.map((r) => r.leaveTypeId));
  return props.leaveTypes.filter((t) => usedTypeIds.has(t.id));
});

const getLeaveRequestsForDate = (date: Date): LeaveRequest[] => {
  return props.leaveRequests.filter((request) => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date >= start && date <= end && request.status === "approved";
  });
};

const previousMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
  );
};

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
  );
};
</script>

<style scoped>
.leave-calendar {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.month-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: #e5e7eb;
}

.nav-btn .icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;
}

.calendar-day:hover {
  background: #f9fafb;
  border-color: #007aff;
}

.calendar-day.other-month {
  opacity: 0.3;
}

.calendar-day.today {
  background: #eff6ff;
  border-color: #007aff;
}

.calendar-day.has-leave {
  background: #fffbeb;
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.leave-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.leave-indicator {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.more-indicator {
  font-size: 10px;
  color: #6b7280;
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
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
}

.legend-label {
  font-size: 14px;
  color: #6b7280;
}

@media (max-width: 640px) {
  .calendar-day {
    padding: 4px;
  }

  .day-number {
    font-size: 12px;
  }

  .weekday {
    font-size: 10px;
  }
}
</style>
