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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EmployeeAbsencesTab,
  EmployeePayslipsTab,
  EmployeeSalaryTab,
  EmployeeVacationsTab,
} from "@/features/employees/EmployeeDetailTabs"
import {
  absencesApi,
  employeesApi,
  payslipsApi,
  performanceApi,
  vacationsApi,
} from "@/lib/hr-api"
import { formatDZD, useTranslation } from "@/lib/i18n"
import { queryKeys } from "@/lib/query-keys"

export const Route = createFileRoute("/_layout/employees/$employeeId")({
  component: EmployeeDetailPage,
  head: () => ({
    meta: [{ title: "Employee Profile - EL-AMEL LAB" }],
  }),
})

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams()
  const { t } = useTranslation()

  const { data: employee, isLoading } = useQuery({
    queryKey: queryKeys.employees.detail(employeeId),
    queryFn: () => employeesApi.get(employeeId),
  })

  const { data: balance } = useQuery({
    queryKey: queryKeys.employees.balance(employeeId),
    queryFn: () => employeesApi.getVacationBalance(employeeId),
  })

  const { data: salaryHistory } = useQuery({
    queryKey: queryKeys.employees.salaryHistory(employeeId),
    queryFn: () => employeesApi.getSalaryHistory(employeeId),
  })

  const { data: absences } = useQuery({
    queryKey: queryKeys.absences.list({ employeeId }),
    queryFn: () => absencesApi.list({ employee_id: employeeId }),
  })

  const { data: vacations } = useQuery({
    queryKey: queryKeys.vacations.list({ employeeId }),
    queryFn: () => vacationsApi.list({ employee_id: employeeId }),
  })

  const { data: reviews } = useQuery({
    queryKey: queryKeys.performance.list({ employeeId }),
    queryFn: () => performanceApi.list({ employee_id: employeeId }),
  })

  const { data: payslips } = useQuery({
    queryKey: queryKeys.payslips.list({ employeeId }),
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
              {t("contactAndCnas")}
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
        <TabsList className="max-w-full overflow-x-auto flex-nowrap sm:flex-wrap h-auto gap-1 no-scrollbar [webkit-overflow-scrolling:touch]">
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
          <EmployeeAbsencesTab absences={absences?.data ?? []} />
        </TabsContent>

        <TabsContent value="vacations" className="mt-4">
          <EmployeeVacationsTab vacations={vacations?.data ?? []} />
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <EmployeeSalaryTab
            salaryHistory={salaryHistory ?? []}
            reviews={reviews?.data ?? []}
          />
        </TabsContent>

        <TabsContent value="payslips" className="mt-4">
          <EmployeePayslipsTab payslips={payslips?.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
