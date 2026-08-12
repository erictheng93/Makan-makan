import type { SchedulingService } from "./SchedulingService";

type CreateScheduleData = Parameters<SchedulingService["createSchedule"]>[0];

const validSchedule: CreateScheduleData = {
  restaurantId: "restaurant-1",
  employeeId: "employee-1",
  workDate: "2026-08-12",
  startTime: "09:00",
  endTime: "17:00",
  scheduledHours: 8,
  createdBy: "manager-1",
};

// This contract fixture ensures the audit attribution cannot become optional.
// @ts-expect-error createdBy is required for every newly scheduled shift.
const scheduleWithoutCreator: CreateScheduleData = {
  restaurantId: "restaurant-1",
  employeeId: "employee-1",
  workDate: "2026-08-12",
  startTime: "09:00",
  endTime: "17:00",
  scheduledHours: 8,
};

void validSchedule;
void scheduleWithoutCreator;
