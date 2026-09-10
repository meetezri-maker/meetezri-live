import type { PlanTier } from "../../../utils/subscriptionPlans";

const BILLING_TIME_ZONE = "UTC";
const DAY_MS = 24 * 60 * 60 * 1000;

type BillingDateInput = {
  planId: PlanTier;
  status?: string | null;
  nextBillingAt?: string | null;
  endDate?: string | null;
  now?: Date;
};

export type BillingDateModel = {
  date: Date | null;
  iso: string | null;
  lead: string;
  fullLabel: string | null;
  longLabel: string | null;
  calendarUrl: string | null;
  cardTitle: string;
  unavailableLabel: string;
  isCancelled: boolean;
  isTrial: boolean;
};

function parseBillingDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function utcDayStartMs(date: Date): number {
  const [year, month, day] = utcDayKey(date).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatBillingDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BILLING_TIME_ZONE,
    ...options,
  }).format(date);
}

export function billingDaysUntil(date: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((utcDayStartMs(date) - utcDayStartMs(now)) / DAY_MS));
}

export function isBillingDateToday(date: Date, now = new Date()): boolean {
  return utcDayKey(date) === utcDayKey(now);
}

export function buildGoogleCalendarBillingUrl(date: Date, isCancelled: boolean): string {
  const ymd = utcDayKey(date).replace(/-/g, "");
  const start = `${ymd}T090000Z`;
  const end = `${ymd}T100000Z`;
  const text = encodeURIComponent(isCancelled ? "Solace — membership access ends" : "Solace — plan renewal");
  const details = encodeURIComponent(
    isCancelled ? "Your Solace membership access period ends." : "Your Solace membership renews."
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${start}/${end}`;
}

export function buildBillingDateModel({
  planId,
  status,
  nextBillingAt,
  endDate,
  now = new Date(),
}: BillingDateInput): BillingDateModel {
  const normalizedStatus = String(status ?? "").toLowerCase();
  const isCancelled = normalizedStatus === "canceled" || normalizedStatus === "cancelled";
  const isTrial = planId === "trial";
  const date = isCancelled
    ? parseBillingDate(nextBillingAt) ?? parseBillingDate(endDate)
    : isTrial
      ? parseBillingDate(endDate)
      : parseBillingDate(nextBillingAt);
  const unavailableLabel = isCancelled
    ? "Access end date unavailable"
    : isTrial
      ? "Trial end date unavailable"
      : "Renewal date unavailable";
  const cardTitle = isCancelled ? "Access until" : isTrial ? "Trial ends" : "Upcoming renewal";

  if (!date) {
    return {
      date: null,
      iso: null,
      lead: unavailableLabel,
      fullLabel: null,
      longLabel: null,
      calendarUrl: null,
      cardTitle,
      unavailableLabel,
      isCancelled,
      isTrial,
    };
  }

  const fullLabel = formatBillingDate(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const longLabel = formatBillingDate(date);
  const daysUntil = billingDaysUntil(date, now);
  const today = isBillingDateToday(date, now);
  const lead = isCancelled
    ? today
      ? "Your membership access ends today."
      : `Your membership access ends on ${longLabel}.`
    : isTrial
      ? today
        ? "Your trial period ends today."
        : `Your trial continues · ${daysUntil} days remaining.`
      : today
        ? "Your membership renews today."
        : `Your membership renews on ${longLabel}.`;

  return {
    date,
    iso: date.toISOString(),
    lead,
    fullLabel,
    longLabel,
    calendarUrl: buildGoogleCalendarBillingUrl(date, isCancelled),
    cardTitle,
    unavailableLabel,
    isCancelled,
    isTrial,
  };
}
