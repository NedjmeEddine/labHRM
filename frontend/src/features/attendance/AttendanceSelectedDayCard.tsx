import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatLocalDate } from "@/lib/date"
import { getAbsenceTypeLabel, getVacationTypeLabel } from "@/lib/domain-labels"
import type { Absence, Vacation } from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"

interface AttendanceSelectedDayCardProps {
  inspectedDay: Date | null
  absences: Absence[]
  vacations: Vacation[]
  onMarkSingleForDate: (isoDate: string) => void
}

export function AttendanceSelectedDayCard({
  inspectedDay,
  absences,
  vacations,
  onMarkSingleForDate,
}: AttendanceSelectedDayCardProps) {
  const { t } = useTranslation()

  if (!inspectedDay) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("clickDayHint")}</p>
        </CardContent>
      </Card>
    )
  }

  const dayIso = formatLocalDate(inspectedDay)
  const dayAbsences = absences.filter((a) => a.date === dayIso)
  const dayVacations = vacations.filter(
    (v) => v.start_date <= dayIso && v.end_date >= dayIso,
  )

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold">
          {t("dayEvents")} {dayIso}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMarkSingleForDate(dayIso)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("add")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {dayAbsences.length === 0 && dayVacations.length === 0 ? (
          <p className="text-muted-foreground">{t("noEventsDay")}</p>
        ) : (
          <>
            {dayAbsences.map((ab) => (
              <div
                key={ab.id}
                className="flex items-center justify-between rounded border px-2.5 py-1.5"
              >
                <div>
                  <span className="font-medium">{ab.employee_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {getAbsenceTypeLabel(ab.absence_type, t)}
                  </span>
                </div>
                <Badge variant={ab.is_paid ? "secondary" : "destructive"}>
                  {ab.is_paid ? t("paid") : t("unpaid")}
                </Badge>
              </div>
            ))}
            {dayVacations.map((vac) => (
              <div
                key={vac.id}
                className="flex items-center justify-between rounded border px-2.5 py-1.5"
              >
                <div>
                  <span className="font-medium">{vac.employee_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {getVacationTypeLabel(vac.vacation_type, t)}
                  </span>
                </div>
                <Badge variant="outline">{t("statusApproved")}</Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
