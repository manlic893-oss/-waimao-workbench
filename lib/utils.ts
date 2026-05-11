import { clsx, type ClassValue } from "clsx";
import { addDays, addMonths, differenceInCalendarDays, format, getDay, isToday, parseISO } from "date-fns";
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

export function getDaysOverdue(date?: string | null) {
  if (!date) return 0;
  const parsed = parseISO(date);
  const days = differenceInCalendarDays(new Date(), parsed);
  return days > 0 ? days : 0;
}

export function getTomorrowDateValue() {
  return toDateInputValue(addDays(new Date(), 1));
}

export function addBusinessDays(date: string | Date, days: number) {
  let current = typeof date === "string" ? parseISO(date) : date;
  let added = 0;

  while (added < days) {
    current = addDays(current, 1);
    const day = getDay(current);
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return toDateInputValue(current);
}

export function addOneMonth(date: string | Date) {
  const value = typeof date === "string" ? parseISO(date) : date;
  return toDateInputValue(addMonths(value, 1));
}

export function getInitials(name: string) {
  return name.trim().charAt(0).toUpperCase();
}
