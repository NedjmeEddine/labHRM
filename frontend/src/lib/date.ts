import { eachDayOfInterval, format, isValid, parseISO } from "date-fns"

export function formatLocalDate(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd")
}

export function safeParseIsoDate(isoDate: string): Date | null {
  try {
    const parsed = parseISO(isoDate)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function safeEachDayOfInterval(
  startIso: string,
  endIso: string,
): Date[] {
  const start = safeParseIsoDate(startIso)
  const end = safeParseIsoDate(endIso)
  if (!start || !end || start > end) {
    return []
  }
  return eachDayOfInterval({ start, end })
}

export function formatDisplayDate(isoDate: string, lang: "fr" | "en"): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toLocaleDateString(lang === "fr" ? "fr-DZ" : "en-US")
}
