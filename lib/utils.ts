import { clsx, type ClassValue } from "clsx";
import { format, isToday, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = "yyyy年MM月dd日") {
  const value = typeof date === "string" ? parseISO(date) : date;
  return format(value, pattern, { locale: zhCN });
}

export function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function isDueTodayOrOverdue(date?: string | null) {
  if (!date) return false;
  const parsed = parseISO(date);
  return format(parsed, "yyyy-MM-dd") <= format(new Date(), "yyyy-MM-dd");
}

export function isDueToday(date?: string | null) {
  if (!date) return false;
  return isToday(parseISO(date));
}

export function getInitials(name: string) {
  return name.trim().charAt(0).toUpperCase();
}
