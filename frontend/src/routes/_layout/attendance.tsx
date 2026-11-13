import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { endOfMonth, startOfMonth } from "date-fns"
import { CalendarPlus, Download, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/Common/ConfirmDeleteDialog"
import { Button } from "@/components/ui/button"
import { AbsenceFormDialog } from "@/features/attendance/AbsenceFormDialog"
import { AttendanceCalendarCard } from "@/features/attendance/AttendanceCalendarCard"
import { AttendanceFilterBar } from "@/features/attendance/AttendanceFilterBar"
import { AttendanceSelectedDayCard } from "@/features/attendance/AttendanceSelectedDayCard"
import {
  AttendanceSummaryCards,
  AttendanceTable,
} from "@/features/attendance/AttendanceTable"
import {
  formatLocalDate,
  safeEachDayOfInterval,
  safeParseIsoDate,
} from "@/lib/date"
import {
  type Absence,
  absencesApi,
  employeesApi,
  extractApiErrorMessage,
  vacationsApi,
} from "@/lib/hr-api"
import { useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

export const Route = createFileRoute("/_layout/attendance")({
  component: AttendancePage,
  head: () => ({
    meta: [{ title: "Attendance & Calendar - EL-AMEL LAB" }],
  }),
})

function AttendancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [today] = useState(() => new Date())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(today),
    to: endOfMonth(today),
  }))
  const [calendarMonth, setCalendarMonth] = useState<Date>(today)
  const [inspectedDay, setInspectedDay] = useState<Date | null>(null)
  const [modalState, setModalState] = useState<{
    mode: "single" | "range"
    defaultDate: string
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null)

  const startStr = range?.from ? formatLocalDate(range.from) : undefined
  const endStr = range?.to ? formatLocalDate(range.to) : startStr

  const calStart = formatLocalDate(startOfMonth(calendarMonth))
  const calEnd = formatLocalDate(endOfMonth(calendarMonth))
  const employeeFilter =
    selectedEmployeeId === "all" ? undefined : selectedEmployeeId

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees.list("all"),
    queryFn: () => employeesApi.list(),
  })

  const { data: intervalSummary } = useQuery({
    queryKey: queryKeys.absences.list({
      employeeId: selectedEmployeeId,
      startDate: startStr,
      endDate: endStr,
    }),
    queryFn: () =>
      absencesApi.list({
        employee_id: employeeFilter,
        start_date: startStr,
        end_date: endStr,
      }),
  })

  // Reuse intervalSummary when the visible month exactly matches the selected interval
  const sameMonthAsInterval = startStr === calStart && endStr === calEnd

  const { data: monthAbsencesQuery } = useQuery({
    queryKey: queryKeys.absences.month({
      employeeId: selectedEmployeeId,
      startDate: calStart,
      endDate: calEnd,
    }),
    queryFn: () =>
      absencesApi.list({
        employee_id: employeeFilter,
        start_date: calStart,
        end_date: calEnd,
      }),
    enabled: !sameMonthAsInterval,
  })

  const monthAbsences = sameMonthAsInterval
    ? intervalSummary
    : monthAbsencesQuery

  const { data: monthVacations } = useQuery({
    queryKey: queryKeys.vacations.month({
      employeeId: selectedEmployeeId,
      startDate: calStart,
      endDate: calEnd,
    }),
    queryFn: () =>
      vacationsApi.list({
        employee_id: employeeFilter,
        status: "approved",
        start_date: calStart,
        end_date: calEnd,
      }),
  })

  const { unpaidDates, paidDates } = useMemo(() => {
    const unpaid: Date[] = []
    const paid: Date[] = []
    if (!monthAbsences) {
      return { unpaidDates: unpaid, paidDates: paid }
    }
    for (const ab of monthAbsences.data) {
      const parsed = safeParseIsoDate(ab.date)
      if (!parsed) continue
      if (ab.is_paid) {
        paid.push(parsed)
      } else {
        unpaid.push(parsed)
      }
    }
    return { unpaidDates: unpaid, paidDates: paid }
  }, [monthAbsences])

  const vacationDates = useMemo(() => {
    if (!monthVacations) return []
    const dates: Date[] = []
    for (const v of monthVacations.data) {
      dates.push(...safeEachDayOfInterval(v.start_date, v.end_date))
    }
    return dates
  }, [monthVacations])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => absencesApi.delete(id),
    onSuccess: () => {
      toast.success(t("toastAbsenceDeleted"))
      queryClient.invalidateQueries({ queryKey: queryKeys.absences.all })
      queryClient.invalidateQueries({ queryKey: ["absences-month"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary })
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, t("toastSaveError")))
    },
  })

  const employees = employeesData?.data ?? []
  const defaultModalEmployeeId =
    selectedEmployeeId !== "all" ? selectedEmployeeId : (employees[0]?.id ?? "")

  const openModal = (mode: "single" | "range", defaultDate?: string) => {
    setModalState({
      mode,
      defaultDate: defaultDate ?? formatLocalDate(today),
    })
  }

  const handleExportCsv = async () => {
    try {
      await absencesApi.exportCsv({
        employee_id: employeeFilter,
        start_date: startStr,
        end_date: endStr,
      })
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("toastExportError")))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("attTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("attSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("exportCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openModal("range")}
          >
            <CalendarPlus className="mr-1.5 h-4 w-4" />
            {t("markRange")}
          </Button>
          <Button size="sm" onClick={() => openModal("single")}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("markSingle")}
          </Button>
        </div>
      </div>

      <AttendanceFilterBar
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeChange={setSelectedEmployeeId}
        startStr={startStr}
        endStr={endStr}
        onStartChange={(from) => {
          setRange((prev) => ({
            from,
            to: prev?.to && prev.to >= from ? prev.to : from,
          }))
          setCalendarMonth(from)
        }}
        onEndChange={(to) => {
          setRange((prev) => ({ from: prev?.from ?? to, to }))
        }}
        onResetThisMonth={() => {
          setRange({ from: startOfMonth(today), to: endOfMonth(today) })
          setCalendarMonth(today)
        }}
      />

      {/* Main Grid: Calendar + Selected Day Left, Summary & List Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 flex flex-col gap-4">
          <AttendanceCalendarCard
            range={range}
            onSelectRange={setRange}
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onInspectDay={setInspectedDay}
            unpaidDates={unpaidDates}
            paidDates={paidDates}
            vacationDates={vacationDates}
          />
          <AttendanceSelectedDayCard
            inspectedDay={inspectedDay}
            absences={monthAbsences?.data ?? []}
            vacations={monthVacations?.data ?? []}
            onMarkSingleForDate={(iso) => openModal("single", iso)}
          />
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <AttendanceSummaryCards summary={intervalSummary} />
          <AttendanceTable
            absences={intervalSummary?.data ?? []}
            onRequestDelete={setDeleteTarget}
          />
        </div>
      </div>

      <AbsenceFormDialog
        mode={modalState?.mode ?? null}
        defaultEmployeeId={defaultModalEmployeeId}
        defaultDate={modalState?.defaultDate ?? formatLocalDate(today)}
        employees={employees}
        onClose={() => setModalState(null)}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={
          deleteTarget
            ? `${deleteTarget.employee_name ?? ""} (${deleteTarget.date})`
            : undefined
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />
    </div>
  )
}
