import { type DateRange, DayPicker } from "react-day-picker"
import { enUS, fr } from "react-day-picker/locale"
import "react-day-picker/style.css"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n"

const MODIFIER_CLASS_NAMES = {
  unpaid: "mod-unpaid",
  paid: "mod-paid",
  vacation: "mod-vacation",
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
          modifiers={{
            unpaid: unpaidDates,
            paid: paidDates,
            vacation: vacationDates,
          }}
          modifiersClassNames={MODIFIER_CLASS_NAMES}
        />
        <div className="mt-4 w-full border-t pt-4 grid grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-full border-2 border-rose-500 bg-rose-100 dark:border-rose-400 dark:bg-rose-950/60 shadow-xs shrink-0" />
            <span className="text-muted-foreground">
              {t("calendarLegendAbsence")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-full border-2 border-amber-500 bg-amber-100 dark:border-amber-400 dark:bg-amber-950/60 shadow-xs shrink-0" />
            <span className="text-muted-foreground">
              {t("calendarLegendPaid")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-full border-2 border-emerald-500 bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/60 shadow-xs shrink-0" />
            <span className="text-muted-foreground">
              {t("calendarLegendVacation")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-full border-2 border-[#005696] dark:border-sky-400 bg-sky-100 dark:bg-sky-500/20 shadow-xs shrink-0" />
            <span className="text-muted-foreground">
              {t("calendarLegendRange")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
