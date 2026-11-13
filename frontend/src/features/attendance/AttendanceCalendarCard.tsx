import type { CSSProperties } from "react"
import { type DateRange, DayPicker } from "react-day-picker"
import { enUS, fr } from "react-day-picker/locale"
import "react-day-picker/style.css"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"

const DAY_PICKER_STYLE = {
  "--rdp-accent-color": "var(--brand)",
  "--rdp-accent-background-color": "var(--mist)",
  "--rdp-range_middle-background-color": "var(--mist)",
  "--rdp-range_middle-color": "var(--brand-deep)",
} as CSSProperties

const MODIFIER_CLASS_NAMES = {
  unpaid:
    "!bg-red-500/20 !text-red-700 dark:!text-red-300 font-bold ring-1 ring-red-500/50",
  paid: "!bg-amber-500/20 !text-amber-700 dark:!text-amber-300 font-bold",
  vacation: "!bg-sky-500/20 !text-sky-700 dark:!text-sky-300 font-semibold",
}

interface AttendanceCalendarCardProps {
  range: DateRange | undefined
  onSelectRange: (range: DateRange | undefined) => void
  calendarMonth: Date
  onMonthChange: (month: Date) => void
  onInspectDay: (day: Date) => void
  unpaidDates: Date[]
  paidDates: Date[]
  vacationDates: Date[]
}

export function AttendanceCalendarCard({
  range,
  onSelectRange,
  calendarMonth,
  onMonthChange,
  onInspectDay,
  unpaidDates,
  paidDates,
  vacationDates,
}: AttendanceCalendarCardProps) {
  const { t, lang } = useTranslation()

  return (
    <Card>
      <CardContent className="pt-6 flex flex-col items-center">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={onSelectRange}
          onDayClick={onInspectDay}
          month={calendarMonth}
          onMonthChange={onMonthChange}
          locale={lang === "fr" ? fr : enUS}
          style={DAY_PICKER_STYLE}
          modifiers={{
            unpaid: unpaidDates,
            paid: paidDates,
            vacation: vacationDates,
          }}
          modifiersClassNames={MODIFIER_CLASS_NAMES}
        />
        <div className="mt-4 w-full border-t pt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-red-500/30 ring-1 ring-red-500/60" />
            <span>{t("calendarLegendAbsence")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-amber-500/30" />
            <span>{t("calendarLegendPaid")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-sky-500/30" />
            <span>{t("calendarLegendVacation")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-primary/20 ring-1 ring-primary" />
            <span>{t("calendarLegendRange")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
