import { startOfDay, subDays } from "date-fns";

export interface WellnessPulseData {
  activeDays: boolean[];
  activeCount: number;
  message: string;
}

interface ActivityRow {
  type: string;
  created_at: string;
}

function normalizeActivityRows(activityRaw: unknown): ActivityRow[] {
  if (Array.isArray(activityRaw)) {
    return activityRaw as ActivityRow[];
  }
  if (
    activityRaw &&
    typeof activityRaw === "object" &&
    Array.isArray((activityRaw as { items?: unknown }).items)
  ) {
    return (activityRaw as { items: ActivityRow[] }).items;
  }
  return [];
}

export function computeWellnessPulse(activityRaw: unknown): WellnessPulseData {
  const rows = normalizeActivityRows(activityRaw);
  const today = startOfDay(new Date());
  const activeDays = Array.from({ length: 7 }, (_, index) => {
    const day = subDays(today, 6 - index);
    const dayStart = day.getTime();
    return rows.some((row) => {
      if (row.type !== "mood" && row.type !== "journal") return false;
      const created = new Date(row.created_at);
      if (Number.isNaN(created.getTime())) return false;
      return startOfDay(created).getTime() === dayStart;
    });
  });

  const activeCount = activeDays.filter(Boolean).length;
  let message = "You've stayed consistent this week.";
  if (activeCount === 0) {
    message = "Your pulse grows with each gentle check-in.";
  } else if (activeCount < 4) {
    message = "You're building momentum this week.";
  } else if (activeCount >= 6) {
    message = "You've stayed consistent this week.";
  } else {
    message = "Nice rhythm — keep showing up for yourself.";
  }

  return { activeDays, activeCount, message };
}
