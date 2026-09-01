import { useI18n } from "@/i18n";
import { Crown, ChefHat, Truck, CreditCard, User } from "lucide-vue-next";
import type { Component } from "vue";

const AVATAR_CLASSES: Record<number, string> = {
  1: "bg-teal-100 text-teal-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-green-100 text-green-700",
  4: "bg-blue-100 text-blue-700",
};

const ROLE_BADGE_CLASSES: Record<number, string> = {
  1: "bg-teal-50 text-teal-700",
  2: "bg-orange-50 text-orange-700",
  3: "bg-green-50 text-green-700",
  4: "bg-blue-50 text-blue-700",
};

const ROLE_ICONS: Record<number, Component> = {
  1: Crown,
  2: ChefHat,
  3: Truck,
  4: CreditCard,
};

const ROLE_KEYS: Record<number, string> = {
  1: "users.roles.owner",
  2: "users.roles.chef",
  3: "users.roles.service",
  4: "users.roles.cashier",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-red-50 text-red-700",
  suspended: "bg-amber-50 text-amber-700",
};

const STATUS_KEYS: Record<string, string> = {
  active: "users.status.active",
  inactive: "users.status.inactive",
  suspended: "users.status.suspended",
};

// i18n-free helpers — exported directly, no composable needed
export const getInitials = (
  nameOrObj:
    | string
    | { fullName?: string; username?: string; employeeName?: string },
): string => {
  const name =
    typeof nameOrObj === "string"
      ? nameOrObj
      : nameOrObj.fullName ||
        nameOrObj.username ||
        nameOrObj.employeeName ||
        "";
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const avatarClass = (role: number): string =>
  AVATAR_CLASSES[role] ?? "bg-gray-100 text-gray-700";

export const roleIcon = (role: number): Component => ROLE_ICONS[role] ?? User;

export const roleBadgeClass = (role: number): string =>
  ROLE_BADGE_CLASSES[role] ?? "bg-gray-50 text-gray-700";

export const statusBadgeClass = (status: string): string =>
  STATUS_BADGE_CLASSES[status] ?? "bg-gray-50 text-gray-700";

// i18n-dependent helpers — need composable wrapper
export function useEmployeeDisplay() {
  const { t } = useI18n();

  const roleText = (role: number): string => {
    const key = ROLE_KEYS[role];
    return key ? t(key) : t("users.roles.unknown");
  };

  const statusText = (status: string): string => {
    const key = STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  return {
    getInitials,
    avatarClass,
    roleIcon,
    roleBadgeClass,
    roleText,
    statusBadgeClass,
    statusText,
  };
}
