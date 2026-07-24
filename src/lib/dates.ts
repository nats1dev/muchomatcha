import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  parseISO,
} from "date-fns";

export const DEFAULT_TZ = "America/Guatemala";

export function nowInTz(tz = DEFAULT_TZ) {
  return toZonedTime(new Date(), tz);
}

export function formatDate(
  date: Date | string,
  pattern = "dd/MM/yyyy",
  tz = DEFAULT_TZ,
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, tz, pattern);
}

export function formatDateTime(
  date: Date | string,
  pattern = "dd/MM/yyyy HH:mm",
  tz = DEFAULT_TZ,
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, tz, pattern);
}

export type PeriodKey = "today" | "7d" | "30d" | "month" | "custom";

export function resolvePeriod(
  key: PeriodKey,
  opts?: { from?: string; to?: string; tz?: string },
): { from: Date; to: Date } {
  const tz = opts?.tz ?? DEFAULT_TZ;
  const now = toZonedTime(new Date(), tz);

  if (key === "custom" && opts?.from && opts?.to) {
    const fromLocal = startOfDay(parseISO(opts.from));
    const toLocal = endOfDay(parseISO(opts.to));
    return {
      from: fromZonedTime(fromLocal, tz),
      to: fromZonedTime(toLocal, tz),
    };
  }

  if (key === "7d") {
    return {
      from: fromZonedTime(startOfDay(subDays(now, 6)), tz),
      to: fromZonedTime(endOfDay(now), tz),
    };
  }

  if (key === "30d") {
    return {
      from: fromZonedTime(startOfDay(subDays(now, 29)), tz),
      to: fromZonedTime(endOfDay(now), tz),
    };
  }

  if (key === "month") {
    return {
      from: fromZonedTime(startOfMonth(now), tz),
      to: fromZonedTime(endOfMonth(now), tz),
    };
  }

  return {
    from: fromZonedTime(startOfDay(now), tz),
    to: fromZonedTime(endOfDay(now), tz),
  };
}
