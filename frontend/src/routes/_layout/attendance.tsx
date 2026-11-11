import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns"
import { CalendarPlus, Download, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { type DateRange, DayPicker } from "react-day-picker"
import { enUS, fr } from "react-day-picker/locale"
import "react-day-picker/style.css"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { absencesApi, employeesApi, vacationsApi } from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/attendance")({
  component: AttendancePage,
  head: () => ({
    meta: [{ title: "Attendance & Calendar - EL-AMEL LAB" }],
  }),
})

function AttendancePage() {
  const { t, lang } = useTranslation()
  const queryClient = useQueryClient()

  const today = new Date()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all")
  const [range, setRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  })
  const [calendarMonth, setCalendarMonth] = useState<Date>(today)

  // Modal state
  const [modalMode, setModalMode] = useState<"single" | "range" | null>(null)
  const [formEmpId, setFormEmpId] = useState("")
  const [formDate, setFormDate] = useState(format(today, "yyyy-MM-dd"))
  const [formEndDate, setFormEndDate] = useState(format(today, "yyyy-MM-dd"))
  const [formType, setFormType] = useState("unjustified")
  const [formIsPaid, setFormIsPaid] = useState(false)
  const [formReason, setFormReason] = useState("")

  const startStr = range?.from ? format(range.from, "yyyy-MM-dd") : undefined
  const endStr = range?.to ? format(range.to, "yyyy-MM-dd") : startStr

  const { data: employeesData } = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => employeesApi.list(),
  })

  // Filtered absences for the interval checker table + KPI cards
  const { data: intervalSummary } = useQuery({
    queryKey: ["absences", selectedEmployeeId, startStr, endStr],
    queryFn: () =>
      absencesApi.list({
        employee_id:
          selectedEmployeeId === "all" ? undefined : selectedEmployeeId,
        start_date: startStr,
        end_date: endStr,
      }),
  })

  // All absences & vacations for the visible calendar month (so dots appear even outside interval)
  const calStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd")
  const calEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd")

  const { data: monthAbsences } = useQuery({
    queryKey: ["absences-month", selectedEmployeeId, calStart, calEnd],
    queryFn: () =>
      absencesApi.list({
        employee_id:
          selectedEmployeeId === "all" ? undefined : selectedEmployeeId,
        start_date: calStart,
        end_date: calEnd,
      }),
  })

  const { data: monthVacations } = useQuery({
    queryKey: ["vacations-month", selectedEmployeeId, calStart, calEnd],
    queryFn: () =>
      vacationsApi.list({
        employee_id:
          selectedEmployeeId === "all" ? undefined : selectedEmployeeId,
        status: "approved",
        start_date: calStart,
        end_date: calEnd,
      }),
  })

  const unpaidDates = useMemo(() => {
    if (!monthAbsences) return []
    return monthAbsences.data
      .filter((a) => !a.is_paid)
      .map((a) => parseISO(a.date))
  }, [monthAbsences])

  const paidDates = useMemo(() => {
    if (!monthAbsences) return []
    return monthAbsences.data
      .filter((a) => a.is_paid)
      .map((a) => parseISO(a.date))
  }, [monthAbsences])

  const vacationDates = useMemo(() => {
    if (!monthVacations) return []
    const dates: Date[] = []
    for (const v of monthVacations.data) {
      const days = eachDayOfInterval({
        start: parseISO(v.start_date),
        end: parseISO(v.end_date),
      })
      dates.push(...days)
    }
    return dates
  }, [monthVacations])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formEmpId) throw new Error("Select employee")
      if (modalMode === "range") {
        return absencesApi.createRange({
          employee_id: formEmpId,
          start_date: formDate,
          end_date: formEndDate,
          absence_type: formType,
          is_paid: formIsPaid,
          reason: formReason || null,
        })
      }
      return absencesApi.create({
        employee_id: formEmpId,
        date: formDate,
        absence_type: formType,
        is_paid: formIsPaid,
        reason: formReason || null,
      })
    },
    onSuccess: () => {
      toast.success("Absence enregistrée")
      queryClient.invalidateQueries({ queryKey: ["absences"] })
      queryClient.invalidateQueries({ queryKey: ["absences-month"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setModalMode(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Erreur")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => absencesApi.delete(id),
    onSuccess: () => {
      toast.success("Absence supprimée")
      queryClient.invalidateQueries({ queryKey: ["absences"] })
      queryClient.invalidateQueries({ queryKey: ["absences-month"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const openModal = (mode: "single" | "range", defaultDate?: string) => {
    setFormEmpId(
      selectedEmployeeId !== "all"
        ? selectedEmployeeId
        : (employeesData?.data[0]?.id ?? ""),
    )
    const d = defaultDate ?? format(today, "yyyy-MM-dd")
    setFormDate(d)
    setFormEndDate(d)
    setFormType("unjustified")
    setFormIsPaid(false)
    setFormReason("")
    setModalMode(mode)
  }

  const getTypeLabel = (type: string) => {
    if (type === "unjustified") return t("absUnjustified")
    if (type === "sick") return t("absSick")
    if (type === "justified") return t("absJustified")
    if (type === "half_day") return t("absHalfDay")
    return type
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("attTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("attSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              absencesApi.exportCsv({
                employee_id:
                  selectedEmployeeId === "all" ? undefined : selectedEmployeeId,
                start_date: startStr,
                end_date: endStr,
              })
            }
          >
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

      {/* Filter & Interval Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("intervalChecker")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("intervalDesc")}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 items-end">
          <div className="grid gap-1.5">
            <Label>{t("navEmployees")}</Label>
            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allEmployees")}</SelectItem>
                {employeesData?.data.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.employee_code} — {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("startDate")}</Label>
            <Input
              type="date"
              value={startStr ?? ""}
              onChange={(e) => {
                if (!e.target.value) return
                const from = parseISO(e.target.value)
                setRange((prev) => ({
                  from,
                  to: prev?.to && prev.to >= from ? prev.to : from,
                }))
                setCalendarMonth(from)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("endDate")}</Label>
            <Input
              type="date"
              value={endStr ?? ""}
              onChange={(e) => {
                if (!e.target.value) return
                const to = parseISO(e.target.value)
                setRange((prev) => ({ from: prev?.from ?? to, to }))
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                setRange({
                  from: startOfMonth(today),
                  to: endOfMonth(today),
                })
                setCalendarMonth(today)
              }}
            >
              Ce mois / Current
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Calendar Left + Interval Summary & List Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Calendar Card */}
        <Card className="lg:col-span-5">
          <CardContent className="pt-6 flex flex-col items-center">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={lang === "fr" ? fr : enUS}
              modifiers={{
                unpaid: unpaidDates,
                paid: paidDates,
                vacation: vacationDates,
              }}
              modifiersClassNames={{
                unpaid:
                  "!bg-red-500/20 !text-red-700 dark:!text-red-300 font-bold ring-1 ring-red-500/50",
                paid: "!bg-amber-500/20 !text-amber-700 dark:!text-amber-300 font-bold",
                vacation:
                  "!bg-sky-500/20 !text-sky-700 dark:!text-sky-300 font-semibold",
              }}
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

        {/* Right Side: Summary Stats + Table */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  {t("totalAbsences")}
                </p>
                <p className="text-xl font-bold mt-1">
                  {intervalSummary?.total_count ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  {t("unpaidDays")}
                </p>
                <p className="text-xl font-bold text-destructive mt-1">
                  {intervalSummary?.unpaid_days ?? 0} {t("day")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t("paidDays")}</p>
                <p className="text-xl font-bold mt-1">
                  {intervalSummary?.paid_days ?? 0} {t("day")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  {t("estimatedDeduction")}
                </p>
                <p className="text-lg font-bold text-destructive mt-1">
                  {formatDZD(intervalSummary?.estimated_deduction ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("fullName")}</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>{t("paid")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intervalSummary && intervalSummary.data.length > 0 ? (
                  intervalSummary.data.map((ab) => (
                    <TableRow key={ab.id}>
                      <TableCell className="font-mono text-xs">
                        {ab.date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ab.employee_name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {getTypeLabel(ab.absence_type)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ab.is_paid ? "secondary" : "destructive"}
                        >
                          {ab.is_paid ? t("paid") : t("unpaid")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ab.reason || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(ab.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mark Absence Dialog */}
      <Dialog
        open={modalMode !== null}
        onOpenChange={(o) => !o && setModalMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalMode === "range" ? t("markRange") : t("markSingle")}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid gap-1.5">
              <Label>{t("selectEmployee")} *</Label>
              <Select value={formEmpId} onValueChange={setFormEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectEmployee")} />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.data.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employee_code} — {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>
                  {modalMode === "range" ? t("startDate") : t("date")}
                </Label>
                <Input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              {modalMode === "range" && (
                <div className="grid gap-1.5">
                  <Label>{t("endDate")}</Label>
                  <Input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => {
                    setFormType(v)
                    setFormIsPaid(v === "justified" || v === "sick")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unjustified">
                      {t("absUnjustified")}
                    </SelectItem>
                    <SelectItem value="sick">{t("absSick")}</SelectItem>
                    <SelectItem value="justified">
                      {t("absJustified")}
                    </SelectItem>
                    <SelectItem value="half_day">{t("absHalfDay")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("paid")} ?</Label>
                <Select
                  value={formIsPaid ? "yes" : "no"}
                  onValueChange={(v) => setFormIsPaid(v === "yes")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{t("unpaid")} (retenue)</SelectItem>
                    <SelectItem value="yes">{t("paid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("reason")}</Label>
              <Input
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalMode(null)}
              >
                {t("cancel")}
              </Button>
              <LoadingButton type="submit" loading={createMutation.isPending}>
                {t("save")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
