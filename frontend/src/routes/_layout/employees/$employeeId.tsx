import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  CalendarX,
  FileText,
  Palmtree,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  absencesApi,
  employeesApi,
  payslipsApi,
  performanceApi,
  vacationsApi,
} from "@/lib/hr-api"
import { formatDZD, MONTHS_EN, MONTHS_FR, useTranslation } from "@/lib/i18n"

export const Route = createFileRoute("/_layout/employees/$employeeId")({
  component: EmployeeDetailPage,
  head: () => ({
    meta: [{ title: "Employee Profile - EL-AMEL LAB" }],
  }),
})

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams()
  const { t, lang } = useTranslation()
  const months = lang === "fr" ? MONTHS_FR : MONTHS_EN

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => employeesApi.get(employeeId),
  })

  const { data: balance } = useQuery({
    queryKey: ["employee-balance", employeeId],
    queryFn: () => employeesApi.getVacationBalance(employeeId),
  })

  const { data: salaryHistory } = useQuery({
    queryKey: ["employee-salary-history", employeeId],
    queryFn: () => employeesApi.getSalaryHistory(employeeId),
  })

  const { data: absences } = useQuery({
    queryKey: ["absences", employeeId],
    queryFn: () => absencesApi.list({ employee_id: employeeId }),
  })

  const { data: vacations } = useQuery({
    queryKey: ["vacations", employeeId],
    queryFn: () => vacationsApi.list({ employee_id: employeeId }),
  })

  const { data: reviews } = useQuery({
    queryKey: ["performance", employeeId],
    queryFn: () => performanceApi.list({ employee_id: employeeId }),
  })

  const { data: payslips } = useQuery({
    queryKey: ["payslips", employeeId],
    queryFn: () => payslipsApi.list({ employee_id: employeeId }),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!employee) {
    return <p className="text-muted-foreground">{t("noData")}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link to="/employees">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.full_name}
            </h1>
            <Badge variant="outline" className="font-mono">
              {employee.employee_code}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.job_title} · {employee.department}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("baseSalary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-brand">
              {formatDZD(employee.base_salary)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("hireDate")}: {employee.hire_date}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("vacationBalance")} ({balance?.year})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {balance?.days_remaining ?? employee.annual_vacation_days}{" "}
              {t("days")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("taken")}: {balance?.days_taken ?? 0} · {t("allowance")}:{" "}
              {balance?.annual_allowance ?? employee.annual_vacation_days}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Contact & CNAS
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{employee.phone || "—"}</p>
            <p className="text-muted-foreground">{employee.email || "—"}</p>
            <p className="text-xs text-muted-foreground">
              CNAS: {employee.social_security_number || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="absences">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="absences" className="gap-1.5">
            <CalendarX className="h-4 w-4" />
            {t("navAttendance")} ({absences?.total_count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="vacations" className="gap-1.5">
            <Palmtree className="h-4 w-4" />
            {t("navVacations")} ({vacations?.count ?? 0})
          </TabsTrigger>
          <TabsTrigger value="salary" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            {t("salaryProgression")}
          </TabsTrigger>
          <TabsTrigger value="payslips" className="gap-1.5">
            <FileText className="h-4 w-4" />
            {t("tabPayslips")} ({payslips?.count ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>{t("paid")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absences && absences.data.length > 0 ? (
                  absences.data.map((ab) => (
                    <TableRow key={ab.id}>
                      <TableCell>{ab.date}</TableCell>
                      <TableCell>{ab.absence_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={ab.is_paid ? "secondary" : "destructive"}
                        >
                          {ab.is_paid ? t("paid") : t("unpaid")}
                        </Badge>
                      </TableCell>
                      <TableCell>{ab.reason || "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-muted-foreground"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vacations" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("endDate")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacations && vacations.data.length > 0 ? (
                  vacations.data.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.start_date}</TableCell>
                      <TableCell>{v.end_date}</TableCell>
                      <TableCell>
                        {v.days_count} {t("days")}
                      </TableCell>
                      <TableCell>{v.vacation_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            v.status === "approved" ? "default" : "secondary"
                          }
                        >
                          {v.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="salary" className="mt-4 space-y-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("previousSalary")}</TableHead>
                  <TableHead>{t("newSalary")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryHistory && salaryHistory.length > 0 ? (
                  salaryHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        {new Date(h.changed_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatDZD(h.previous_salary)}</TableCell>
                      <TableCell className="font-semibold text-brand">
                        {formatDZD(h.new_salary)}
                      </TableCell>
                      <TableCell>{h.reason}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-muted-foreground"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {reviews && reviews.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("tabPerformance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviews.data.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {months[r.period_month - 1]} {r.period_year} ·{" "}
                        {"★".repeat(r.score)}
                        {"☆".repeat(5 - r.score)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.notes || "—"}
                      </p>
                    </div>
                    <Badge>{formatDZD(r.bonus_amount)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payslips" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("month")} / {t("year")}
                  </TableHead>
                  <TableHead>{t("grossSalary")}</TableHead>
                  <TableHead>{t("absenceDeduction")}</TableHead>
                  <TableHead>{t("netSalary")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips && payslips.data.length > 0 ? (
                  payslips.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {months[p.month - 1]} {p.year}
                      </TableCell>
                      <TableCell>{formatDZD(p.gross_salary)}</TableCell>
                      <TableCell className="text-destructive">
                        {formatDZD(p.absence_deduction)}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatDZD(p.net_salary)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "paid" ? "default" : "secondary"
                          }
                        >
                          {p.status === "paid"
                            ? t("statusPaid")
                            : t("statusDraft")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => payslipsApi.downloadPdf(p, false)}
                        >
                          <FileText className="mr-1.5 h-4 w-4" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-6 text-muted-foreground"
                    >
                      {t("noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
